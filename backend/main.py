from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image
import numpy as np
import cv2
import io
import os
import time
import base64

# ──────────────────────────────────────────────
#  App
# ──────────────────────────────────────────────
app = FastAPI(
    title="CattleScan API",
    description="ResNet-50 cattle disease detector with GradCAM — LSD & FMD",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
#  Config
# ──────────────────────────────────────────────
CLASS_NAMES = ["Normal", "LSD_Mild", "LSD_Severe", "FMD_Mild", "FMD_Severe"]

CLASS_INFO = {
    "Normal": {
        "severity": "none",
        "label": "Normal — Healthy Cattle",
        "description": (
            "No signs of disease detected. The animal appears to be in good health "
            "with no visible lesions or abnormalities."
        ),
        "recommendation": (
            "Continue routine monitoring and vaccination schedule. "
            "Maintain herd hygiene and biosecurity practices."
        ),
    },
    "LSD_Mild": {
        "severity": "mild",
        "label": "Lumpy Skin Disease — Mild",
        "description": (
            "Early-stage Lumpy Skin Disease detected. Small nodular skin lesions may "
            "be present. The animal may show mild fever and reduced appetite."
        ),
        "recommendation": (
            "Isolate the animal from the herd immediately. Contact a veterinarian "
            "for antiviral treatment and supportive care. Monitor other animals closely."
        ),
    },
    "LSD_Severe": {
        "severity": "severe",
        "label": "Lumpy Skin Disease — Severe",
        "description": (
            "Advanced Lumpy Skin Disease detected. Extensive nodular skin lesions, "
            "high fever, and tissue damage are likely present."
        ),
        "recommendation": (
            "URGENT: Quarantine immediately. Call a licensed veterinarian without "
            "delay. Report to local animal disease control authority. Do not move the animal."
        ),
    },
    "FMD_Mild": {
        "severity": "mild",
        "label": "Foot-and-Mouth Disease — Mild",
        "description": (
            "Early signs of Foot-and-Mouth Disease detected. Small vesicles may appear "
            "on the mouth, tongue, or hooves. FMD is extremely contagious."
        ),
        "recommendation": (
            "Isolate immediately — FMD spreads rapidly between animals. Contact a "
            "veterinarian urgently. This is a notifiable disease in most regions."
        ),
    },
    "FMD_Severe": {
        "severity": "severe",
        "label": "Foot-and-Mouth Disease — Severe",
        "description": (
            "Severe Foot-and-Mouth Disease detected. Extensive lesions on the mouth, "
            "tongue, dental pad, and hooves. The animal is likely unable to eat or walk normally."
        ),
        "recommendation": (
            "CRITICAL: Quarantine all animals on the premises. Notify veterinary "
            "authorities and government animal health departments immediately. "
            "Do not move any animals off the farm."
        ),
    },
}

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

inference_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

# ──────────────────────────────────────────────
#  GradCAM Implementation
# ──────────────────────────────────────────────
class GradCAM:
    """
    GradCAM for ResNet-50.
    Hooks into the final convolutional layer (layer4) to capture
    activations and gradients for the predicted class.
    """
    def __init__(self, model):
        self.model     = model
        self.gradients = None
        self.activations = None
        self._register_hooks()

    def _register_hooks(self):
        # Target: last conv block of ResNet-50 = model.layer4[-1]
        target_layer = self.model.layer4[-1]

        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_input, grad_output):
            self.gradients = grad_output[0].detach()

        target_layer.register_forward_hook(forward_hook)
        target_layer.register_full_backward_hook(backward_hook)

    def generate(self, tensor, class_idx):
        """
        Run forward + backward pass and return the GradCAM heatmap
        as a numpy array (H, W) with values in [0, 1].
        """
        self.model.zero_grad()

        # Forward pass — keep gradients
        output = self.model(tensor)
        score  = output[0, class_idx]

        # Backward pass for the target class
        score.backward()

        # Global average pool the gradients over spatial dims
        # gradients: (1, C, H, W)  →  weights: (C,)
        weights = self.gradients.mean(dim=[0, 2, 3])  # (C,)

        # Weighted combination of activation maps
        # activations: (1, C, H, W)
        cam = torch.zeros(self.activations.shape[2:], dtype=torch.float32)
        for i, w in enumerate(weights):
            cam += w * self.activations[0, i]

        # ReLU — keep only positive influences
        cam = F.relu(cam)

        # Normalise to [0, 1]
        cam = cam - cam.min()
        if cam.max() > 0:
            cam = cam / cam.max()

        return cam.cpu().numpy()


def generate_gradcam_overlay(image_pil, cam_array, alpha=0.45):
    """
    Overlay the GradCAM heatmap on the original image.
    Returns a base64-encoded JPEG string.
    """
    # Resize original image to 224x224 to match model input
    img_resized = image_pil.resize((224, 224))
    img_np      = np.array(img_resized)           # (224, 224, 3) RGB uint8

    # Resize CAM to match image dimensions
    cam_resized = cv2.resize(cam_array, (224, 224))

    # Convert CAM to colour heatmap (COLORMAP_JET: blue=low, red=high)
    cam_uint8   = np.uint8(255 * cam_resized)
    heatmap_bgr = cv2.applyColorMap(cam_uint8, cv2.COLORMAP_JET)
    heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)

    # Blend original image with heatmap
    overlay = (1 - alpha) * img_np + alpha * heatmap_rgb
    overlay = np.clip(overlay, 0, 255).astype(np.uint8)

    # Also produce a pure heatmap (no blend) for the side-by-side view
    heatmap_only = heatmap_rgb.astype(np.uint8)

    # Encode both to base64 JPEG
    def to_b64(arr):
        img_pil   = Image.fromarray(arr)
        buf       = io.BytesIO()
        img_pil.save(buf, format="JPEG", quality=88)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    return to_b64(overlay), to_b64(heatmap_only)


# ──────────────────────────────────────────────
#  Model loading
# ──────────────────────────────────────────────
device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model     = None
gradcam   = None
model_loaded = False


def load_model(path: str = "model_final.pth") -> bool:
    global model, gradcam, model_loaded
    try:
        m = models.resnet50(weights=None)
        m.fc = nn.Linear(m.fc.in_features, len(CLASS_NAMES))

        if not os.path.exists(path):
            print(f"[WARN] '{path}' not found — starting in DEMO mode.")
            m.eval()
            model     = m.to(device)
            gradcam   = GradCAM(model)
            model_loaded = False
            return False

        ckpt  = torch.load(path, map_location=device)
        state = ckpt.get("model_state_dict", ckpt)
        m.load_state_dict(state)
        m.eval()
        model     = m.to(device)
        gradcam   = GradCAM(model)        # Attach hooks after loading weights
        model_loaded = True
        print(f"[OK] ResNet-50 loaded from '{path}' on {device}")
        return True

    except Exception as exc:
        print(f"[ERROR] Model load failed: {exc}")
        raise RuntimeError(str(exc))


@app.on_event("startup")
async def on_startup():
    path = os.environ.get("MODEL_PATH", "model_final.pth")
    load_model(path)


# ──────────────────────────────────────────────
#  Routes
# ──────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "app": "CattleScan API",
        "model": "ResNet-50",
        "gradcam": True,
        "status": "running",
        "model_loaded": model_loaded,
        "device": str(device),
        "classes": CLASS_NAMES,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "ResNet-50",
        "gradcam": True,
        "model_loaded": model_loaded,
        "device": str(device),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted.")

    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialised. Check server logs.")

    try:
        t0    = time.time()
        raw   = await file.read()
        image = Image.open(io.BytesIO(raw)).convert("RGB")

        # Preprocessing
        tensor = inference_transform(image).unsqueeze(0).to(device)

        # ── Standard inference (no grad) ──────────────────────────────
        with torch.no_grad():
            logits = model(tensor)
            probs  = torch.softmax(logits, dim=1).squeeze()

        pred_idx   = int(probs.argmax())
        pred_class = CLASS_NAMES[pred_idx]
        confidence = round(float(probs[pred_idx]) * 100, 2)
        all_conf   = {CLASS_NAMES[i]: round(float(probs[i]) * 100, 2)
                      for i in range(len(CLASS_NAMES))}

        # ── GradCAM (needs grad enabled) ──────────────────────────────
        # Re-run forward pass with gradients enabled for GradCAM
        tensor_grad = inference_transform(image).unsqueeze(0).to(device)
        tensor_grad.requires_grad_(False)   # input doesn't need grad
        model.zero_grad()

        cam_array = gradcam.generate(tensor_grad, pred_idx)
        overlay_b64, heatmap_b64 = generate_gradcam_overlay(image, cam_array)

        elapsed_ms = round((time.time() - t0) * 1000, 1)

        return JSONResponse({
            "prediction":      pred_class,
            "confidence":      confidence,
            "all_confidences": all_conf,
            "class_info":      CLASS_INFO[pred_class],
            "elapsed_ms":      elapsed_ms,
            "filename":        file.filename,
            "model_loaded":    model_loaded,
            "gradcam": {
                "overlay":  overlay_b64,    # original image + heatmap blended
                "heatmap":  heatmap_b64,    # pure heatmap only
            },
        })

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}")
