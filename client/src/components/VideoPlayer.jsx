import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';

const VideoPlayer = forwardRef(({ videoUrl, results }, ref) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [currentTime, setCurrentTime] = useState(0);

  // Set up video dimensions once metadata is loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
    }
  };

  useImperativeHandle(ref, () => ({
    seek: (time) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    }
  }));

  const drawBoundingBoxes = (time) => {
    if (!canvasRef.current || !videoRef.current || results.length === 0) return;
    
    // Find results for the current second (closest timestamp)
    // Since ML extracts at 1fps, timestamps are integers 0, 1, 2...
    const currentSecond = Math.floor(time);
    const frameResult = results.find(r => r.timestamp === currentSecond);
    
    const ctx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    ctx.clearRect(0, 0, width, height);

    if (frameResult && frameResult.detections) {
      // Calculate scale. ML bounding boxes are based on original video resolution
      const scaleX = width / videoDimensions.width;
      const scaleY = height / videoDimensions.height;

      frameResult.detections.forEach(det => {
        const [x1, y1, x2, y2] = det.box;
        const conf = (det.confidence * 100).toFixed(0);
        
        // Scale coordinates to display canvas
        const sx = x1 * scaleX;
        const sy = y1 * scaleY;
        const sWidth = (x2 - x1) * scaleX;
        const sHeight = (y2 - y1) * scaleY;

        // Colors
        ctx.strokeStyle = '#10b981'; // emerald-500
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        
        ctx.beginPath();
        ctx.rect(sx, sy, sWidth, sHeight);
        ctx.fill();
        ctx.stroke();

        // Draw label
        ctx.fillStyle = '#10b981';
        ctx.fillRect(sx, sy - 25, ctx.measureText(`${det.class} ${conf}%`).width + 16, 25);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px "Inter", sans-serif';
        ctx.fontWeight = 'bold';
        ctx.fillText(`${det.class} ${conf}%`, sx + 8, sy - 8);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      drawBoundingBoxes(time);
    }
  };

  useEffect(() => {
    let animationFrameId;
    
    // Smooth drawing loop for bounding boxes if video is playing
    const renderLoop = () => {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        drawBoundingBoxes(videoRef.current.currentTime);
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    
    // Only run the loop if playing
    if (isPlaying) {
      renderLoop();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, results, videoDimensions]);

  // Handle window resize to adjust canvas
  useEffect(() => {
    const handleResize = () => {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.offsetWidth;
        canvasRef.current.height = videoRef.current.offsetHeight;
        drawBoundingBoxes(videoRef.current.currentTime);
      }
    };
    
    window.addEventListener('resize', handleResize);
    // Initial size
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, [videoDimensions]);

  return (
    <div className="vp-wrap">
      {videoUrl ? (
        <>
          <video
            ref={videoRef}
            src={videoUrl}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            controls
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            crossOrigin="anonymous"
          />
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
          <div className="vp-time">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:
            {Math.floor(currentTime % 60).toString().padStart(2, '0')}
          </div>
        </>
      ) : (
        <div className="vp-loading">
          <div className="vp-spinner" />
          <span>Processing video…</span>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
