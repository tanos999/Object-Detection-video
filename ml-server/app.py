from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import io
from PIL import Image
import threading

app = Flask(__name__)
CORS(app)

model = None
model_lock = threading.Lock()

def load_model():
    global model
    with model_lock:
        if model is None:
            print("Loading YOLO model...")
            model = YOLO('yolov8n.pt')
            print("Model loaded.")

# Load model in a separate thread so startup isn't blocked completely if we want to add more logic
threading.Thread(target=load_model).start()

@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    image_bytes = file.read()
    
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = np.array(image)
        # Convert RGB to BGR for OpenCV/YOLO
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    global model
    with model_lock:
        if model is None:
            return jsonify({'error': 'Model is still loading, please try again later.'}), 503
        
        results = model(image)
    
    detections = []
    for result in results:
        boxes = result.boxes
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            label = model.names[cls_id]
            
            detections.append({
                'box': [x1, y1, x2, y2],
                'confidence': conf,
                'class': label
            })
            
    return jsonify({'detections': detections})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)
