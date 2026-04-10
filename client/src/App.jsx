import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import VideoUploader from './components/VideoUploader';
import VideoPlayer from './components/VideoPlayer';

const API_URL    = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

function App() {
  const [uploadId,   setUploadId]   = useState(null);
  const [status,     setStatus]     = useState(null);
  const [progress,   setProgress]   = useState({ processed: 0, total: 0 });
  const [results,    setResults]    = useState([]);
  const [socket,     setSocket]     = useState(null);
  const [videoUrl,   setVideoUrl]   = useState(null);
  const [videoName,  setVideoName]  = useState('');
  const playerRef = useRef(null);

  /* ── Reset ─────────────────────────────── */
  const resetSession = () => {
    setUploadId(null);
    setStatus(null);
    setProgress({ processed: 0, total: 0 });
    setResults([]);
    setVideoUrl(null);
    setVideoName('');
    if (socket) {
      socket.off('statusUpdate');
      socket.off('progressUpdate');
    }
  };

  /* ── Seek helper ─────────────────────────────── */
  const handleSeek = (ts) => {
    if (playerRef.current) playerRef.current.seek(ts);
  };

  /* ── Socket setup ─────────────────────────────── */
  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);
    return () => s.close();
  }, []);

  /* ── Fetch results ─────────────────────────────── */
  const fetchResults = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/results/${id}`);
      if (res.data?.results) setResults(res.data.results);
    } catch (err) {
      console.error('Failed to fetch results', err);
    }
  };

  /* ── Subscribe to socket events ─────────────────── */
  useEffect(() => {
    if (!socket || !uploadId) return;
    socket.emit('subscribe', uploadId);
    socket.on('statusUpdate',   (d) => { setStatus(d.status); if (d.status === 'completed') fetchResults(uploadId); });
    socket.on('progressUpdate', (d) => setProgress({ processed: d.processed, total: d.total }));
    return () => { socket.off('statusUpdate'); socket.off('progressUpdate'); };
  }, [socket, uploadId]);

  /* ── Upload complete ─────────────────────────────── */
  const handleUploadComplete = (data, uploadedUrl, name) => {
    setUploadId(data.uploadId);
    setStatus(data.status);
    setVideoUrl(uploadedUrl);
    setVideoName(name || 'Untitled video');
  };

  /* ── Export JSON ─────────────────────────────── */
  const downloadResults = () => {
    const blob = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', blob);
    a.setAttribute('download', `detections_${uploadId}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  /* ── Derived stats ─────────────────────────────── */
  const framesWithDetections = results.filter(r => r.detections?.length > 0).length;
  const totalDetections      = results.reduce((acc, r) => acc + (r.detections?.length || 0), 0);
  const progressPct          = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const statusClass          = `s-pill sp-${status || 'pending'}`;

  return (
    <div className="app-shell">

      {/* ── Topbar ───────────────────── */}
      <header className="topbar">
        <div className="topbar-left">
          <span className="app-logo">⬡</span>
          <span className="app-name">ObjectSense</span>
          {uploadId && (
            <>
              <span className="bc-sep">/</span>
              <span className="bc-item">{videoName}</span>
            </>
          )}
        </div>

        <div className="topbar-right">
          {uploadId && (
            <button className="btn" onClick={resetSession}>
              + New Video
            </button>
          )}
          <div className="live-badge">
            <span className="live-dot" />
            Live
          </div>
        </div>
      </header>

      <main className="main-content">

        {/* ── Upload view ───────────────────── */}
        {!uploadId ? (
          <div className="upload-page">
            <div className="page-header">
              <span className="page-emoji">🎬</span>
              <h1 className="page-h1">Object Detection</h1>
              <p className="page-desc">
                Upload a video to detect and track objects frame-by-frame using the YOLO AI model.
              </p>
            </div>
            <div className="hr" />
            <VideoUploader onUploadComplete={handleUploadComplete} apiUrl={API_URL} />
          </div>

        ) : (

          /* ── Results view ───────────────────── */
          <div className="results-layout">

            {/* Left column */}
            <div className="results-left">

              {/* Status card — always visible at top */}
              <div className="status-card">
                <div className="sc-head">
                  <span className="sc-label">Processing Status</span>
                  <span className={statusClass}>{status || 'pending'}</span>
                </div>

                {status !== 'completed' ? (
                  <div className="prog-area">
                    <div className="prog-label-row">
                      <span className="prog-pct">{progressPct}%</span>
                      {progress.total > 0 && (
                        <span className="prog-frames">{progress.processed} / {progress.total} frames</span>
                      )}
                    </div>
                    <div className="prog-track">
                      <div className="prog-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                    {status === 'detecting' && progress.total > 0 && (
                      <span className="prog-frames" style={{ textAlign: 'center' }}>
                        Running ML detection on frames…
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="completion-info">
                    <span className="done-text">✓ Detection complete</span>
                    <div className="stat-group">
                      <div className="stat-box">
                        <span className="stat-num">{framesWithDetections}</span>
                        <span className="stat-lbl">Frames</span>
                      </div>
                      <div className="stat-box">
                        <span className="stat-num">{totalDetections}</span>
                        <span className="stat-lbl">Objects</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Video player — fills remaining height */}
              <div className="video-wrap">
                <VideoPlayer ref={playerRef} videoUrl={videoUrl} results={results} />
              </div>
            </div>

            {/* Right sidebar — detections */}
            <div className="det-sidebar">
              <div className="det-head">
                <span className="sc-label">Detections Log</span>
                {status === 'completed' && (
                  <button className="btn btn-sm" onClick={downloadResults}>
                    Export JSON ↓
                  </button>
                )}
              </div>

              <div className="det-list">
                {results.filter(r => r.detections?.length > 0).length > 0 ? (
                  results
                    .filter(r => r.detections?.length > 0)
                    .map((res, i) => (
                      <div key={i} className="det-row">
                        <button
                          className="ts-btn"
                          onClick={() => handleSeek(res.timestamp)}
                          title="Jump to this moment"
                        >
                          {String(Math.floor(res.timestamp / 60)).padStart(2, '0')}:
                          {String(Math.floor(res.timestamp % 60)).padStart(2, '0')}
                        </button>
                        <div className="det-tags">
                          {res.detections.map((det, j) => (
                            <span key={j} className="det-tag">
                              {det.class}
                              <span className="det-conf">{(det.confidence * 100).toFixed(0)}%</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="det-empty">
                    <span className="det-empty-icon">◯</span>
                    <span>No detections yet</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default App;
