import React, { useCallback, useState } from 'react';
import axios from 'axios';

const VideoUploader = ({ onUploadComplete, apiUrl }) => {
  const [isDragging,      setIsDragging]      = useState(false);
  const [file,            setFile]            = useState(null);
  const [uploading,       setUploading]       = useState(false);
  const [error,           setError]           = useState(null);
  const [uploadProgress,  setUploadProgress]  = useState(0);

  /* ── Drag handlers ─────────────────────────────── */
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  }, []);

  /* ── Validation ─────────────────────────────── */
  const validateFile = (f) => {
    setError(null);
    if (!f) return false;
    if (!['video/mp4', 'video/quicktime'].includes(f.type)) {
      setError('Only MP4 and MOV files are supported.');
      return false;
    }
    if (f.size > 100 * 1024 * 1024) {
      setError('File is too large. Maximum size is 100 MB.');
      return false;
    }
    return true;
  };

  /* ── Drop / change ─────────────────────────────── */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && validateFile(dropped)) setFile(dropped);
  }, []);

  const handleChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected && validateFile(selected)) setFile(selected);
  };

  /* ── Upload ─────────────────────────────── */
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await axios.post(`${apiUrl}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (pe) => {
          setUploadProgress(Math.round((pe.loaded * 100) / pe.total));
        },
      });

      if (response.data) {
        const ext     = file.name.substring(file.name.lastIndexOf('.'));
        const fileUrl = `${apiUrl}/videos/${response.data.uploadId}${ext}`;
        onUploadComplete(response.data, fileUrl, file.name);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  /* ── Zone class ─────────────────────────────── */
  const zoneClass = [
    'drop-zone',
    isDragging ? 'dz-drag' : '',
    file        ? 'dz-file' : '',
  ].filter(Boolean).join(' ');

  return (
    <div>
      {/* Drop zone */}
      <div
        className={zoneClass}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !file && !uploading && document.getElementById('fileInput').click()}
      >
        <input
          id="fileInput"
          type="file"
          style={{ display: 'none' }}
          accept="video/mp4,video/quicktime"
          onChange={handleChange}
          disabled={uploading}
        />

        {file ? (
          <>
            <span className="dz-icon">✓</span>
            <p className="dz-title">{file.name}</p>
            <p className="dz-meta">
              {(file.size / (1024 * 1024)).toFixed(2)} MB &nbsp;·&nbsp; {file.type}
            </p>
          </>
        ) : (
          <>
            <span className="dz-icon">{isDragging ? '📂' : '📁'}</span>
            <p className="dz-title">
              {isDragging ? 'Drop to add file' : 'Drag & drop your video here'}
            </p>
            <p className="dz-sub">or click to browse files</p>
            <p className="dz-meta">Supports MP4 and MOV · max 100 MB</p>
          </>
        )}

        {error && (
          <div className="dz-error">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Upload button / progress */}
      {file && (
        <div className="upload-submit">
          {uploading ? (
            <div className="upload-progress" style={{ width: '100%' }}>
              <div className="up-row">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <button className="btn-primary" onClick={handleUpload}>
                Analyse Video →
              </button>
              <button
                className="btn-link"
                onClick={() => { setFile(null); setError(null); }}
              >
                Clear selection
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
