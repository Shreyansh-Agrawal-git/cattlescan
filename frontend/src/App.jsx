import React, { useState, useRef, useCallback, useEffect } from 'react'
import './index.css'
import './App.css'

// ── Data ──────────────────────────────────────────────────────────────────────

const CLASS_DATA = {
  Normal: {
    sev:'none', sevLabel:'HEALTHY', label:'Normal — Healthy Cattle',
    description:'No signs of disease detected. The animal appears to be in good health with no visible lesions or abnormalities on the skin, mouth, or hooves.',
    recommendation:'Continue routine monitoring and vaccination schedule. Maintain herd hygiene and biosecurity practices to prevent future disease.',
  },
  LSD_Mild: {
    sev:'mild', sevLabel:'MILD', label:'Lumpy Skin Disease — Mild',
    description:'Early-stage Lumpy Skin Disease detected. Small nodular skin lesions may be present. The animal may show mild fever, reduced milk production, and loss of appetite.',
    recommendation:'Isolate the animal from the herd immediately. Contact a veterinarian for antiviral treatment and supportive care. Inspect all other animals for similar symptoms.',
  },
  LSD_Severe: {
    sev:'severe', sevLabel:'SEVERE', label:'Lumpy Skin Disease — Severe',
    description:'Advanced Lumpy Skin Disease detected. Extensive nodular skin lesions, high fever, and tissue necrosis are likely present. Animal welfare is at serious risk.',
    recommendation:'URGENT: Quarantine immediately. Call a licensed veterinarian without delay. Report to local animal disease control authority. Do not move the animal off the premises.',
  },
  FMD_Mild: {
    sev:'mild', sevLabel:'MILD', label:'Foot-and-Mouth Disease — Mild',
    description:'Early signs of Foot-and-Mouth Disease detected. Small vesicles may appear on the mouth, tongue, dental pad, or hooves. FMD is extremely contagious and spreads rapidly.',
    recommendation:'Isolate immediately — FMD spreads via direct contact, aerosols, and contaminated surfaces. Contact a veterinarian urgently. This is a legally notifiable disease.',
  },
  FMD_Severe: {
    sev:'severe', sevLabel:'SEVERE', label:'Foot-and-Mouth Disease — Severe',
    description:'Severe Foot-and-Mouth Disease detected. Extensive lesions on mouth, tongue, dental pad, and hooves. The animal is likely unable to eat or walk normally.',
    recommendation:'CRITICAL: Notifiable disease. Quarantine ALL animals on the premises. Notify veterinary authorities and government animal health departments immediately.',
  },
}

const BAR_COLORS = {
  Normal:'#4a9e6e', LSD_Mild:'#c4922a', LSD_Severe:'#c94a4a',
  FMD_Mild:'#c07c1a', FMD_Severe:'#a83030',
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SevIcon({ sev }) {
  const c = sev==='none' ? '#5dbf84' : sev==='mild' ? '#d4922a' : '#c94a4a'
  if (sev==='none') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 11l5 5 9-9" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (sev==='mild') return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M9.5 3.8L1.9 17a1.8 1.8 0 001.6 2.7h15.1a1.8 1.8 0 001.6-2.7L12.5 3.8a1.8 1.8 0 00-3.1 0z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M11 9v4M11 15.5v.5" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke={c} strokeWidth="1.6"/>
      <path d="M11 7v5M11 15v.5" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// ── GradCAM Panel ─────────────────────────────────────────────────────────────

function GradCAMPanel({ gradcam, prediction }) {
  const [activeTab, setActiveTab] = useState('overlay')

  if (!gradcam) return null

  const tabs = [
    { id: 'overlay', label: 'Overlay',  desc: 'Heatmap blended on original image' },
    { id: 'heatmap', label: 'Heatmap',  desc: 'Pure activation heatmap' },
  ]

  return (
    <div className="gradcam-panel anim-in">
      <div className="gradcam-header">
        <div className="gradcam-title-row">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="6.5" stroke="var(--green-bright)" strokeWidth="1.2"/>
            <circle cx="7.5" cy="7.5" r="3"   stroke="var(--green-bright)" strokeWidth="1.2" strokeDasharray="2 1.5"/>
            <circle cx="7.5" cy="7.5" r="1"   fill="var(--green-bright)"/>
          </svg>
          <span className="gradcam-title">GradCAM Explainability</span>
        </div>
        <p className="gradcam-subtitle">
          Gradient-weighted Class Activation Mapping — shows which regions
          of the image the model focused on to make its prediction.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="gradcam-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`gradcam-tab${activeTab===t.id?' gradcam-tab--active':''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Image display */}
      <div className="gradcam-images">
        <div className="gradcam-img-wrap">
          <img
            src={`data:image/jpeg;base64,${gradcam[activeTab]}`}
            alt={activeTab}
            className="gradcam-img"
          />
          <div className="gradcam-img-label">
            {tabs.find(t=>t.id===activeTab)?.desc}
          </div>
        </div>
      </div>

      {/* Colour scale legend */}
      <div className="gradcam-legend">
        <div className="gradcam-scale">
          <div className="gradcam-scale-bar"/>
          <div className="gradcam-scale-labels">
            <span>Low activation</span>
            <span>High activation</span>
          </div>
        </div>
        <p className="gradcam-legend-note">
          <strong>Red / yellow</strong> regions had the highest influence on the
          <strong> {prediction?.replace('_', ' ')}</strong> prediction.
          <strong> Blue</strong> regions were largely ignored by the model.
        </p>
      </div>
    </div>
  )
}

// ── Camera Modal ──────────────────────────────────────────────────────────────

function CameraModal({ onCapture, onClose }) {
  const vidRef    = useRef()
  const canvasRef = useRef()
  const streamRef = useRef()
  const [ready,  setReady]  = useState(false)
  const [facing, setFacing] = useState('environment')
  const [err,    setErr]    = useState(null)

  const start = useCallback(async (mode) => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    setErr(null); setReady(false)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode:mode, width:{ideal:1280}, height:{ideal:720} }, audio:false
      })
      streamRef.current = s
      if (vidRef.current) { vidRef.current.srcObject = s; vidRef.current.play(); setReady(true) }
    } catch { setErr('Camera access denied. Please allow camera permission and try again.') }
  }, [])

  useEffect(() => {
    start(facing)
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()) }
  }, [facing, start])

  const shoot = () => {
    const v = vidRef.current, c = canvasRef.current
    if (!v || !c) return
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob(blob => {
      const f = new File([blob], `scan_${Date.now()}.jpg`, { type:'image/jpeg' })
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      onCapture(f)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="cam-overlay" onClick={onClose}>
      <div className="cam-modal" onClick={e => e.stopPropagation()}>
        <div className="cam-top">
          <span className="cam-title-text">Capture Image</span>
          <button className="cam-x" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="cam-vf">
          {err ? (
            <div className="cam-err">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="12" stroke="#c94a4a" strokeWidth="1.5"/>
                <path d="M14 9v6M14 18v.5" stroke="#c94a4a" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p>{err}</p>
            </div>
          ) : (
            <>
              <video ref={vidRef} className="cam-feed" autoPlay playsInline muted/>
              <div className="cam-corner tl"/><div className="cam-corner tr"/>
              <div className="cam-corner bl"/><div className="cam-corner br"/>
            </>
          )}
          <canvas ref={canvasRef} style={{display:'none'}}/>
        </div>
        <div className="cam-btns">
          <button className="cam-flip-btn" onClick={() => setFacing(p => p==='environment'?'user':'environment')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 10a8 8 0 0114.93-4M18 10a8 8 0 01-14.93 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M16 4v4h-4M4 16v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="cam-shutter" onClick={shoot} disabled={!ready||!!err}>
            <span className="cam-shutter-inner"/>
          </button>
          <button className="cam-cancel-btn" onClick={onClose}>Cancel</button>
        </div>
        <p className="cam-caption">Point at the cattle — skin, muzzle, tongue, or full body</p>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(null)
  const [drag,    setDrag]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)
  const [apiOk,   setApiOk]   = useState(null)
  const [showCam, setShowCam] = useState(false)

  const fileRef    = useRef()
  const resultRef  = useRef()
  const gradcamRef = useRef()

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setApiOk(d.model_loaded ? 'ready' : 'demo'))
      .catch(() => setApiOk('offline'))
  }, [])

  const applyFile = useCallback((f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Please use a JPG, PNG, or WebP image.'); return }
    if (f.size > 20*1024*1024) { setError('Image must be under 20 MB.'); return }
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError(null)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false); applyFile(e.dataTransfer.files[0])
  }, [applyFile])

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await fetch('/api/predict', { method:'POST', body:fd })
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.detail||`Error ${res.status}`) }
      const data = await res.json()
      setResult(data)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 80)
      setTimeout(() => gradcamRef.current?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 400)
    } catch(e) {
      setError(e.message.includes('fetch') ? 'Cannot reach backend.\nRun: uvicorn main:app --reload --port 8000' : e.message)
    } finally { setLoading(false) }
  }

  const reset = () => {
    setFile(null); setPreview(null); setResult(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const info = result ? CLASS_DATA[result.prediction] : null
  const sev  = info?.sev

  return (
    <div className="page">

      {showCam && <CameraModal onCapture={f=>{setShowCam(false);applyFile(f)}} onClose={()=>setShowCam(false)}/>}

      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#4a9e6e" strokeWidth="1.4"/>
                <circle cx="12" cy="12" r="5.5" stroke="#4a9e6e" strokeWidth="1.2" strokeDasharray="2.2 2"/>
                <circle cx="12" cy="12" r="2.2" fill="#5dbf84"/>
              </svg>
            </div>
            <span className="logo-name">Cattle<em>Scan</em></span>
          </div>
          <span className="header-tagline">AI-Powered Disease Detection System</span>
          <div className="header-spacer"/>
          <div className="status-chip">
            <span className={`status-dot status-dot--${apiOk??'loading'}`}/>
            <span className="status-text">
              {apiOk===null&&'connecting'}{apiOk==='ready'&&'model ready'}{apiOk==='demo'&&'demo mode'}{apiOk==='offline'&&'api offline'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="hero anim-up">
        <div className="hero-eyebrow">
          <span className="hero-eyebrow-dot"/>
          ResNet-50 · PyTorch · GradCAM Explainability
        </div>
        <h1>Detect cattle disease<br/>with <span>confidence</span></h1>
        <p className="hero-sub">
          Upload or capture a photo of your cattle. Our model classifies
          Lumpy Skin Disease and Foot-and-Mouth Disease — with GradCAM
          heatmaps showing exactly what the model looked at.
        </p>
      </div>

      {/* ── Workspace ── */}
      <main className="main">
        <div className="container">
          <div className="workspace">

            {/* LEFT — input */}
            <div className="panel anim-up d1">
              <div className="panel-header">
                <span className="panel-label">Input</span>
                {file && !loading && (
                  <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--cream-3)',fontSize:'12px',fontFamily:'var(--font-mono)',letterSpacing:'0.04em'}} onClick={reset}>
                    ✕ clear
                  </button>
                )}
              </div>

              {!file ? (
                <>
                  <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}}
                    onChange={e => applyFile(e.target.files[0])}/>
                  <div
                    className={`dropzone${drag?' dropzone--over':''}`}
                    onDragOver={e=>{e.preventDefault();setDrag(true)}}
                    onDragLeave={()=>setDrag(false)}
                    onDrop={handleDrop}
                    onClick={()=>fileRef.current?.click()}
                    role="button" tabIndex={0}
                    onKeyDown={e=>e.key==='Enter'&&fileRef.current?.click()}
                  >
                    <div className="dz-icon-ring">
                      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                        <path d="M13 18V10M13 10l-4 4M13 10l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M5 20h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".4"/>
                        <rect x="2" y="2" width="22" height="22" rx="5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 3" opacity=".4"/>
                      </svg>
                    </div>
                    <p className="dz-title">{drag ? 'Release to upload' : 'Drop your image here'}</p>
                    <p className="dz-sub">or <span className="dz-link">browse files</span></p>
                    <p className="dz-meta">JPG · PNG · WEBP · MAX 20 MB</p>
                  </div>
                  <div className="or-divider">OR</div>
                  <button className="cam-trigger" onClick={()=>setShowCam(true)}>
                    <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                      <path d="M21 17a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h3.5L8 4h6l1.5 2H19a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                      <circle cx="11" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
                    </svg>
                    Use Camera
                    <span className="cam-badge">mobile</span>
                  </button>
                </>
              ) : (
                <div className="preview-area">
                  <div className="img-frame">
                    <img src={preview} alt="cattle" className="preview-img"/>
                    {loading && (
                      <div className="scan-overlay">
                        <div className="scan-beam"/>
                        <span className="scan-text">Scanning…</span>
                      </div>
                    )}
                    {!loading && (
                      <button className="img-change-btn" onClick={reset}>
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                        Change
                      </button>
                    )}
                  </div>
                  <div className="file-pill">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="1" width="12" height="12" rx="2.5" stroke="#4a9e6e" strokeWidth="1"/>
                      <path d="M1 7.5l3-3L6.5 7l3.5-4L13 8" stroke="#4a9e6e" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="file-pill-name">{file.name}</span>
                    <span className="file-pill-size">{(file.size/1024).toFixed(0)} KB</span>
                  </div>
                </div>
              )}

              <button
                className={`detect-btn${loading?' detect-btn--loading':''}`}
                onClick={file ? handleAnalyze : ()=>fileRef.current?.click()}
                disabled={loading}
              >
                {loading ? (
                  <><span className="spinner"/>Analyzing + GradCAM…</>
                ) : file ? (
                  <>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                      <circle cx="8.5" cy="8.5" r="7.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M5.5 8.5l2 2L11.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Run Detection + GradCAM
                  </>
                ) : (
                  <>
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                      <rect x="2" y="2" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2"/>
                      <path d="M8.5 5.5v6M5.5 8.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                    Select Image
                  </>
                )}
              </button>
              <p className="panel-footnote">Prediction + GradCAM heatmap generated simultaneously</p>
            </div>

            {/* RIGHT — result */}
            <div className="panel anim-up d2" ref={resultRef}>
              <div className="panel-header">
                <span className="panel-label">Result</span>
                {result && <span style={{fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--cream-3)'}}>{result.elapsed_ms} ms</span>}
              </div>

              {/* Idle */}
              {!result&&!loading&&!error&&(
                <div className="idle-state">
                  <div className="idle-rings">
                    <div className="idle-ring"/><div className="idle-ring"/><div className="idle-ring"/>
                  </div>
                  <p className="idle-title">No analysis yet</p>
                  <p className="idle-sub">Upload or capture a photo,<br/>then click <strong>Run Detection + GradCAM</strong></p>
                  <div className="legend">
                    {[['Normal','#4a9e6e'],['LSD Mild','#c4922a'],['LSD Severe','#c94a4a'],['FMD Mild','#c07c1a'],['FMD Severe','#a83030']].map(([l,c])=>(
                      <div className="legend-item" key={l}>
                        <span className="legend-dot" style={{background:c}}/>
                        <span className="legend-lbl">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading&&(
                <div className="loading-state">
                  <span className="spinner spinner--lg"/>
                  <p className="loading-title">Running inference + GradCAM</p>
                  <p className="loading-sub">ResNet-50 · Generating heatmap…</p>
                  <div className="skel">
                    <div className="skel-line"/><div className="skel-line"/><div className="skel-line"/>
                  </div>
                </div>
              )}

              {/* Error */}
              {error&&!loading&&(
                <div className="error-state">
                  <div className="error-ring">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#c94a4a" strokeWidth="1.4"/>
                      <path d="M12 7v6M12 15.5v.5" stroke="#c94a4a" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="error-title">Error</p>
                  <p className="error-body">{error}</p>
                  <button className="btn-retry" onClick={reset}>Try again</button>
                </div>
              )}

              {/* Result */}
              {result&&info&&!loading&&(
                <div className="result anim-in">

                  <div className={`sev-card sev-card--${sev}`}>
                    <div className="sev-icon"><SevIcon sev={sev}/></div>
                    <div className="sev-pill">
                      <span style={{width:'5px',height:'5px',borderRadius:'50%',background:'currentColor',flexShrink:0}}/>
                      {info.sevLabel}
                    </div>
                    <p className="sev-name">{info.label}</p>
                    <p className="sev-conf" style={{gridColumn:2}}>{result.confidence.toFixed(1)}% confidence</p>
                  </div>

                  <p className="result-desc">{info.description}</p>

                  <div className={`rec-card rec-card--${sev}`}>
                    <div className="rec-head">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.1"/>
                        <path d="M6 3.5v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Recommended Action
                    </div>
                    <p className="rec-body">{info.recommendation}</p>
                  </div>

                  {result.all_confidences&&(
                    <div className="conf-wrap">
                      <p className="conf-heading">Class Probabilities</p>
                      {Object.entries(result.all_confidences).sort(([,a],[,b])=>b-a).map(([cls,val])=>{
                        const top = cls===result.prediction
                        const col = BAR_COLORS[cls]||'#555'
                        return (
                          <div className="bar-row" key={cls}>
                            <span className={`bar-lbl${top?' bar-lbl--top':''}`}>{cls.replace('_',' ')}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{width:`${val}%`,background:top?col:'rgba(255,255,255,0.08)'}}/>
                            </div>
                            <span className={`bar-val${top?' bar-val--top':''}`} style={top?{color:col}:{}}>{val.toFixed(1)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="result-footer">
                    <span className="result-meta">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <rect x=".5" y=".5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth=".8"/>
                        <path d="M.5 3.5h10" stroke="currentColor" strokeWidth=".8"/>
                      </svg>
                      {result.filename}
                    </span>
                    <span className="result-meta">ResNet-50</span>
                    <span className="result-meta result-meta--gradcam">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <circle cx="5" cy="5" r="4" stroke="var(--green-bright)" strokeWidth="1"/>
                        <circle cx="5" cy="5" r="1.5" fill="var(--green-bright)"/>
                      </svg>
                      GradCAM
                    </span>
                    {!result.model_loaded&&<span className="result-meta result-meta--warn">demo mode</span>}
                  </div>

                  <button className="btn-new" onClick={reset}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M1.5 6.5a5 5 0 019-3M11.5 6.5a5 5 0 01-9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M11.5 2.5v4h-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Analyze another image
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── GradCAM Section — full width below workspace ── */}
          {result?.gradcam && (
            <div ref={gradcamRef} className="anim-up">
              <GradCAMPanel gradcam={result.gradcam} prediction={result.prediction}/>
            </div>
          )}

          {/* ── Info ── */}
          <div className="info-grid anim-up d3">
            <div className="info-card">
              <h3 className="info-card-title">How it works</h3>
              <div className="steps">
                {[
                  {n:'01', t:'Upload or Capture', d:'Drop a photo, browse your files, or use your phone\'s camera to take a live photo of the cattle.'},
                  {n:'02', t:'ResNet-50 Inference', d:'The model processes the image through 50 convolutional layers fine-tuned on cattle disease imagery to classify the condition.'},
                  {n:'03', t:'GradCAM Heatmap', d:'Gradient-weighted Class Activation Mapping computes which image regions most influenced the prediction — displayed as a colour heatmap.'},
                ].map(s=>(
                  <div className="step" key={s.n}>
                    <span className="step-n">{s.n}</span>
                    <div><p className="step-title">{s.t}</p><p className="step-desc">{s.d}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-card">
              <h3 className="info-card-title">Detected Conditions</h3>
              <div className="disease-list">
                <div className="disease-item disease-item--lsd">
                  <div className="disease-head">
                    <span className="disease-abbr">LSD</span>
                    <span className="disease-name">Lumpy Skin Disease</span>
                  </div>
                  <p className="disease-desc">Viral disease causing nodular skin lesions, fever, and reduced milk production. Spread by biting insects. Classified as <em>Mild</em> or <em>Severe</em>.</p>
                </div>
                <div className="disease-item disease-item--fmd">
                  <div className="disease-head">
                    <span className="disease-abbr">FMD</span>
                    <span className="disease-name">Foot-and-Mouth Disease</span>
                  </div>
                  <p className="disease-desc">Highly contagious viral disease with vesicles on mouth, tongue, and hooves. Notifiable worldwide. Classified as <em>Mild</em> or <em>Severe</em>.</p>
                </div>
              </div>
              <div className="stack-wrap">
                <p className="stack-label">Model Stack</p>
                <div className="stack-tags">
                  {['ResNet-50','PyTorch','GradCAM','FixMatch SSL','Focal Loss','Label Smoothing','RandAugment','5 Classes'].map(t=>(
                    <span className="stack-tag" key={t}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <span>CattleScan — Minor Project</span>
          <span className="footer-sep">·</span>
          <span>ResNet-50 · GradCAM · LSD &amp; FMD Detection</span>
          <span className="footer-sep">·</span>
          <span>Normal · LSD Mild · LSD Severe · FMD Mild · FMD Severe</span>
          <span className="footer-sep">·</span>
          <a className="footer-link" href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">API Docs ↗</a>
        </div>
      </footer>

    </div>
  )
}
