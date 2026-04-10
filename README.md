# ObjectSense - Video Object Detection

A full-stack monorepo application to upload videos, extract frames, process them through an ML server running YOLO object detection, and visualize the findings in real-time.

## Project Structure

- `/client` - React frontend (Vite & TailwindCSS), handles UI, real-time updates (Socket.IO), and rendering bounding boxes on the video canvas.
- `/server` - Node.js Express backend, handles MongoDB database operations, multer video uploads, and coordinates FFmpeg frame extraction.
- `/ml-server` - Python Flask application running a state-of-the-art YOLOv8 object detection model via `ultralytics`.

## Prerequisites

- Node.js & npm
- Python 3.8+
- MongoDB instance running locally (port `27017`)
- FFmpeg installed on your system system-wide

## Setup Instructions

### 1. ML Server
```bash
cd ml-server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```
*Runs on port 5002*

### 2. Backend Server
```bash
cd server
npm install
node index.js
```
*Runs on port 5000*

### 3. Frontend Client
```bash
cd client
npm install
npm run dev
```
*Runs on default Vite port (5173)*

## API Endpoints (Backend Server)

- `POST /api/upload`: Expects `multipart/form-data` with `video` field. Starts background processing. Returns `{ uploadId, status }`.
- `GET /api/status/:uploadId`: Returns the current processing status.
- `GET /api/results/:uploadId`: Returns JSON of all processed frames with bounding boxes, confidence, and class names.
- `GET /api/videos/:filename`: Serves the original uploaded video for playback.

## Demo Instructions (for browser agent)
A test video will automatically upload and demonstrate the real time extraction and ML detection process. Bounding boxes appear as playback aligns with timestamps.

## Notes & Assumptions
- Max video upload size is 100MB
- Supported formats: MP4, MOV
- Extracted frames scale bounding boxes accurately to original video dimensions over a live HTML canvas.
