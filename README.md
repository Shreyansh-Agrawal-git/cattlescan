# CattleScan — Cattle Disease Detector

ResNet-50 powered web app for detecting Lumpy Skin Disease (LSD) and
Foot-and-Mouth Disease (FMD) in cattle images.

## Classes

| Label      | Meaning                              |
| ---------- | ------------------------------------ |
| Normal     | Healthy cattle, no disease detected  |
| LSD_Mild   | Lumpy Skin Disease — early stage     |
| LSD_Severe | Lumpy Skin Disease — advanced        |
| FMD_Mild   | Foot-and-Mouth Disease — early stage |
| FMD_Severe | Foot-and-Mouth Disease — severe      |

---

## Project Structure

```
cattlescan/
│
├── backend/
│   ├── main.py            ← FastAPI server (all inference logic)
│   ├── requirements.txt   ← Python dependencies
│   └── best_model.pth     ← ⬅ YOU MUST PLACE YOUR MODEL FILE HERE
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js     ← proxies /api → localhost:8000
    └── src/
        ├── main.jsx
        ├── index.css      ← CSS variables and global reset
        ├── App.jsx        ← entire React app
        └── App.css        ← all component styles
```

---

## Setup in VS Code

### Step 1 — Place your model file

Copy your trained model file into the backend folder:

```
cattlescan/backend/best_model.pth
```

### Step 2 — Open two terminals in VS Code

Press Ctrl + ` to open the integrated terminal, then click the + icon to open a second one.

---

### Terminal 1 — Start the Backend (FastAPI)

```bash
cd cattlescan/backend

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the server
uvicorn main:main --reload --port 8000
```

You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
[OK] Model loaded from 'best_model.pth' on cpu
```

---

### Terminal 2 — Start the Frontend (React + Vite)

```bash
cd cattlescan/frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

You should see:

```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

---

### Step 3 — Open the app

Visit: http://localhost:5173

---

## How the proxy works

Vite is configured to forward any request starting with `/api/` to the FastAPI
server on port 8000. So `fetch('/api/predict')` in React goes to
`http://localhost:8000/predict` — no CORS issues, no hardcoded ports in React.

---

## API Endpoints

| Method | URL                           | Description                   |
| ------ | ----------------------------- | ----------------------------- |
| GET    | http://localhost:8000/        | API status                    |
| GET    | http://localhost:8000/health  | Health check + model status   |
| POST   | http://localhost:8000/predict | Upload image → get prediction |
| GET    | http://localhost:8000/docs    | Swagger UI (auto-generated)   |

### POST /predict — example response

```json
{
  "prediction": "LSD_Severe",
  "confidence": 94.7,
  "all_confidences": {
    "Normal": 1.2,
    "LSD_Mild": 3.1,
    "LSD_Severe": 94.7,
    "FMD_Mild": 0.6,
    "FMD_Severe": 0.4
  },
  "class_info": {
    "severity": "severe",
    "label": "Lumpy Skin Disease — Severe",
    "description": "Advanced Lumpy Skin Disease...",
    "recommendation": "URGENT: Quarantine immediately..."
  },
  "elapsed_ms": 43.2,
  "filename": "cow_photo.jpg",
  "model_loaded": true
}
```

---

## Troubleshooting

**"Cannot reach the backend"**
→ Make sure `uvicorn main:main --reload --port 8000` is running in Terminal 1.

**"API Offline" indicator in the header**
→ Same — backend is not running.

**"Demo mode" in the header**
→ The backend is running but `best_model.pth` was not found in the backend folder.
Copy your `.pth` file to `cattlescan/backend/best_model.pth`.

**Model loading error**
→ The script handles both plain state_dict and checkpoint dict formats automatically.
If you see an error, check that the .pth file is not corrupted.

**Port already in use**
→ Change the port: `uvicorn main:main --reload --port 8001`
Then update `vite.config.js` target from 8000 to 8001.

# cattlescan
