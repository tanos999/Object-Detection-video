import React, { useCallback, useState } from 'react';
import axios from 'axios';
import { UploadCloud, FileVideo, AlertCircle, CheckCircle2, Activity } from 'lucide-react';

const VideoUploader = ({ onUploadComplete, apiUrl }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const validateFile = (file) => {
    setError(null);
    if (!file) return false;
    
    const validTypes = ['video/mp4', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Only MP4 and MOV are allowed.');
      return false;
    }
    
    if (file.size > 100 * 1024 * 1024) {
      setError('File size too large. Maximum size is 100MB.');
      return false;
    }
    
    return true;
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  }, []);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await axios.post(`${apiUrl}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data) {
        // Mock a URL for the video player since it's now on the server
        const fileUrl = `${apiUrl}/videos/${response.data.uploadId}${file.name.substring(file.name.lastIndexOf('.'))}`;
        onUploadComplete(response.data, fileUrl);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error uploading file.');
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div 
        className={`relative group border-2 border-dashed rounded-3xl p-12 transition-all duration-300 ${
          isDragging 
            ? 'border-indigo-500 bg-indigo-500/10' 
            : file 
              ? 'border-emerald-500/50 bg-emerald-500/5' 
              : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="fileInput"
          className="hidden"
          onChange={handleChange}
          accept="video/mp4,video/quicktime"
          disabled={uploading}
        />
        
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          <div className={`p-6 rounded-full transition-colors duration-300 ${
            isDragging ? 'bg-indigo-500/20 text-indigo-400' :
            file ? 'bg-emerald-500/20 text-emerald-400' :
            'bg-gray-800 text-gray-400 group-hover:bg-gray-700'
          }`}>
            {file ? <CheckCircle2 className="w-12 h-12" /> : <UploadCloud className="w-12 h-12" />}
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-semibold">
              {file ? file.name : 'Drag & drop your video here'}
            </h3>
            <p className="text-gray-400">
              {file 
                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB • ${file.type}`
                : 'Or click to browse files (MP4/MOV, max 100MB)'}
            </p>
          </div>

          {!file && (
            <label 
              htmlFor="fileInput" 
              className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-colors shadow-lg shadow-white/5 active:scale-95"
            >
              <FileVideo className="w-5 h-5" />
              Browse Files
            </label>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-3 rounded-lg border border-red-400/20">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>

      {file && (
        <div className="mt-8 flex flex-col items-center max-w-md mx-auto">
          {!uploading ? (
            <button
              onClick={handleUpload}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              Upload and Process <Activity className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-full space-y-3">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-indigo-400">Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3 border border-gray-700 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {!uploading && (
            <button
              onClick={() => { setFile(null); setError(null); }}
              className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
