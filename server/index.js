import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import mongoose from 'mongoose';
import * as socketIo from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Video from './models/Video.js';
import { processVideo } from './services/videoProcessor.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new socketIo.Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Set up io in app so it can be accessed elsewhere if needed
app.set('io', io);

// Database connection
mongoose.connect('mongodb://localhost:27017/video-object-detector', {
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Multer configured for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'video/mp4' || file.mimetype === 'video/quicktime') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4 and MOV are allowed.'));
    }
  }
});

// Endpoint: Upload Video
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const uploadId = path.parse(req.file.filename).name;

    const newVideo = new Video({
      uploadId: uploadId,
      filename: req.file.filename,
      status: 'pending'
    });

    await newVideo.save();

    // Start background processing
    processVideo(newVideo, io);

    res.status(202).json({ uploadId: uploadId, status: 'pending' });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Get Status
app.get('/api/status/:uploadId', async (req, res) => {
  try {
    const video = await Video.findOne({ uploadId: req.params.uploadId });
    if (!video) {
        return res.status(404).json({ error: 'Video not found' });
    }
    res.json({
        uploadId: video.uploadId,
        status: video.status,
        framesData: video.framesData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Get Results
app.get('/api/results/:uploadId', async (req, res) => {
    try {
        const video = await Video.findOne({ uploadId: req.params.uploadId });
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        res.json({
            uploadId: video.uploadId,
            status: video.status,
            results: video.results
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
});

// Serve uploaded original videos
app.use('/api/videos', express.static(path.join(__dirname, 'uploads')));

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('subscribe', (uploadId) => {
      console.log(`Socket ${socket.id} joined room ${uploadId}`);
      socket.join(uploadId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
