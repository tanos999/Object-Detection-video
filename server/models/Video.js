import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  uploadId: {
    type: String,
    required: true,
    unique: true
  },
  filename: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'extracting', 'detecting', 'completed', 'failed'],
    default: 'pending'
  },
  framesData: {
    type: Number, // Number of frames extracted
    default: 0
  },
  results: [
    {
      timestamp: Number, // In seconds
      detections: [
        {
          class: String,
          confidence: Number,
          box: [Number] // [x1, y1, x2, y2]
        }
      ]
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Video = mongoose.model('Video', videoSchema);

export default Video;
