import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:5002/detect';

export const processVideo = async (videoDoc, io) => {
    try {
        const videoPath = path.join(__dirname, '../uploads', videoDoc.filename);
        const framesDir = path.join(__dirname, '../uploads', `frames_${videoDoc.uploadId}`);
        
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
        }

        // Update status to extracting
        videoDoc.status = 'extracting';
        await videoDoc.save();
        io.to(videoDoc.uploadId).emit('statusUpdate', { status: 'extracting' });

        // Extract frames (1 fps)
        console.log(`Starting frame extraction for ${videoDoc.filename}`);
        
        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .outputOptions([
                    '-vf fps=1' // 1 frame per second
                ])
                .output(path.join(framesDir, 'frame_%d.jpg'))
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        const frameFiles = fs.readdirSync(framesDir).filter(file => file.startsWith('frame_') && file.endsWith('.jpg'))
                           .sort((a, b) => {
                               // Sort naturally by frame number (frame_1, frame_2... instead of frame_1, frame_10)
                               const numA = parseInt(a.match(/frame_(\d+)\.jpg/)[1]);
                               const numB = parseInt(b.match(/frame_(\d+)\.jpg/)[1]);
                               return numA - numB;
                           });

        videoDoc.framesData = frameFiles.length;
        videoDoc.status = 'detecting';
        await videoDoc.save();
        io.to(videoDoc.uploadId).emit('statusUpdate', { status: 'detecting', totalFrames: frameFiles.length });

        console.log(`Extracted ${frameFiles.length} frames for ${videoDoc.filename}`);

        const results = [];
        let framesProcessed = 0;

        // Process each frame
        for (let i = 0; i < frameFiles.length; i++) {
            const frameFile = frameFiles[i];
            const framePath = path.join(framesDir, frameFile);
            
            // Frame number is also its timestamp since we extracted at 1 fps
            // Usually starts at 1, so timestamp is i seconds
            const timestamp = i;

            try {
                const formData = new FormData();
                formData.append('image', fs.createReadStream(framePath));

                const response = await axios.post(ML_SERVER_URL, formData, {
                    headers: formData.getHeaders(),
                    maxBodyLength: Infinity
                });

                if (response.data && response.data.detections) {
                    results.push({
                        timestamp: timestamp,
                        detections: response.data.detections
                    });
                }
            } catch (mlError) {
                console.error(`Error processing frame ${frameFile}:`, mlError.message);
                // We don't fail the whole video for one frame failure, log and continue
            }

            framesProcessed++;
            // Emit progress every frame
            io.to(videoDoc.uploadId).emit('progressUpdate', { 
                processed: framesProcessed, 
                total: frameFiles.length 
            });
        }

        // Processing complete
        videoDoc.results = results;
        videoDoc.status = 'completed';
        await videoDoc.save();
        io.to(videoDoc.uploadId).emit('statusUpdate', { status: 'completed' });
        
        console.log(`Processing complete for ${videoDoc.filename}`);

        // Clean up extracted frames
        fs.rmSync(framesDir, { recursive: true, force: true });

    } catch (error) {
        console.error('Video Processing Error:', error);
        videoDoc.status = 'failed';
        await videoDoc.save();
        io.to(videoDoc.uploadId).emit('statusUpdate', { status: 'failed', error: error.message });
        
        // Try cleanup
        const framesDir = path.join(__dirname, '../uploads', `frames_${videoDoc.uploadId}`);
        if(fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true, force: true });
    }
};
