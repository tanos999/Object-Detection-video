import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import VideoUploader from './components/VideoUploader';
import VideoPlayer from './components/VideoPlayer';
import { Layers, Activity } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

function App() {
  const [uploadId, setUploadId] = useState(null);
  const [status, setStatus] = useState(null); // pending, extracting, detecting, completed, failed
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [socket, setSocket] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const playerRef = useRef(null);

  const handleSeek = (timestamp) => {
    if (playerRef.current) {
      playerRef.current.seek(timestamp);
    }
  };

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  const fetchResults = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/results/${id}`);
      if (res.data && res.data.results) {
        setResults(res.data.results);
      }
    } catch (err) {
      console.error('Failed to fetch results', err);
    }
  };

  useEffect(() => {
    if (socket && uploadId) {
      socket.emit('subscribe', uploadId);

      socket.on('statusUpdate', (data) => {
        setStatus(data.status);
        if (data.status === 'completed') {
          fetchResults(uploadId);
        }
      });

      socket.on('progressUpdate', (data) => {
        setProgress({ processed: data.processed, total: data.total });
      });
    }

    return () => {
      if (socket) {
        socket.off('statusUpdate');
        socket.off('progressUpdate');
      }
    };
  }, [socket, uploadId]);

  const handleUploadComplete = (data, uploadedVideoUrl) => {
    setUploadId(data.uploadId);
    setStatus(data.status);
    setVideoUrl(uploadedVideoUrl);
  };



  const downloadResults = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `results_${uploadId}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-indigo-500 selection:text-white">
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">ObjectSense AI</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Activity className="w-4 h-4" />
          <span>System Active</span>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8">
        {!uploadId ? (
          <div className="max-w-3xl mx-auto mt-12 fade-in">
            <div className="mb-10 text-center">
              <h2 className="text-4xl font-extrabold mb-4 tracking-tight">Detect Objects in Real-Time</h2>
              <p className="text-gray-400 text-lg">Upload any video to get AI-powered bounding box detections powered by YOLO.</p>
            </div>
            <VideoUploader onUploadComplete={handleUploadComplete} apiUrl={API_URL} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
                <VideoPlayer ref={playerRef} videoUrl={videoUrl} results={results} />
              </div>
              
              <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Processing Timeline</h3>
                  {status === 'completed' && (
                    <button 
                      onClick={downloadResults}
                      className="text-sm bg-indigo-600 hover:bg-indigo-500 transition-colors px-4 py-2 rounded-lg font-medium"
                    >
                      Export JSON
                    </button>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block py-1 px-3 uppercase rounded-full text-indigo-400 bg-indigo-400/10 border border-indigo-400/20">
                          {status}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-gray-400">
                          {progress.total > 0 ? `${Math.round((progress.processed / progress.total) * 100)}%` : '0%'}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-gray-700">
                      <div 
                        style={{ width: progress.total > 0 ? `${(progress.processed / progress.total) * 100}%` : '0%' }} 
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                      ></div>
                    </div>
                    {status === 'detecting' && (
                      <p className="text-xs text-gray-400 text-center animate-pulse">Running ML classifications on frames ({progress.processed}/{progress.total})...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl overflow-hidden flex flex-col h-[600px]">
              <div className="p-6 border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm z-10 sticky top-0">
                <h3 className="text-xl font-semibold">Detections Log</h3>
                <p className="text-xs text-gray-400 mt-1">Objects identified over time</p>
              </div>
              <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                {results.length > 0 ? (
                  results.filter(r => r.detections && r.detections.length > 0).map((res, i) => (
                    <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-indigo-500/30 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div 
                          onClick={() => handleSeek(res.timestamp)}
                          className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-1 rounded font-mono cursor-pointer hover:bg-indigo-500/40 transition-colors"
                          title="Click to jump to this frame"
                        >
                          {String(Math.floor(res.timestamp / 60)).padStart(2, '0')}:
                          {String(Math.floor(res.timestamp % 60)).padStart(2, '0')}
                        </div>
                        <span className="text-xs text-gray-400">{res.detections.length} objects found</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {res.detections.map((det, j) => (
                          <div key={j} className="flex flex-col gap-1 bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg">
                            <span className="text-sm font-medium capitalize">{det.class}</span>
                            <span className="text-[10px] text-emerald-400 font-mono">{(det.confidence * 100).toFixed(1)}% conf</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
                    <Activity className="w-8 h-8 opacity-20" />
                    <p className="text-sm">No detections yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; }
        .fade-in { animation: fadeIn 0.5s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default App;
