from flask import Flask, jsonify, request
from flask_cors import CORS
import random
import time

# Initialize the Flask application
app = Flask(__name__)

# Enable Cross-Origin Resource Sharing (CORS) so the React frontend (Vite, usually running on port 5173)
# can safely request resources from this server.
CORS(app)

# ==========================================
# ENDPOINTS
# ==========================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify that the backend is running properly.
    Returns:
        JSON response with the current system status.
    """
    return jsonify({
        "status": "healthy",
        "timestamp": time.time(),
        "service": "Flood Pulse AI Backend API",
        "version": "1.0.0"
    }), 200

@app.route('/api/telemetry', methods=['GET'])
def get_telemetry():
    """
    Simulates real-time telemetry from river gauging stations.
    Returns:
        JSON payload containing sensor readouts and alert levels.
    """
    # Simulate slightly fluctuating readings for realism
    water_level = round(random.uniform(3.5, 7.8), 2)  # in meters
    flow_rate = round(water_level * 180.5 + random.uniform(-10, 10), 1)  # m^3/s
    precipitation = round(random.uniform(0.0, 45.0), 1)  # in mm
    
    # Determine risk level based on mock thresholds
    if water_level > 7.0:
        alert_status = "CRITICAL"
        description = "Water levels exceed critical flood line. Immediate evacuation recommended in low-lying zones."
    elif water_level > 5.5:
        alert_status = "WARNING"
        description = "Elevated water levels. Monitoring river pulses closely."
    else:
        alert_status = "NORMAL"
        description = "River levels within historical baseline bounds."

    return jsonify({
        "station": "Amazon Basin Gauging Station #12",
        "timestamp": time.time(),
        "data": {
            "water_level_m": water_level,
            "flow_rate_m3s": flow_rate,
            "precipitation_mm": precipitation,
            "soil_moisture_pct": round(random.uniform(45.0, 95.0), 1),
            "humidity_pct": round(random.uniform(70.0, 99.0), 1)
        },
        "alert": {
            "status": alert_status,
            "description": description
        }
    }), 200

@app.route('/api/predict', methods=['POST'])
def run_prediction():
    """
    Simulated AI Prediction model endpoint. 
    Accepts zone parameters (zone_name, rainfall_mm, water_level_m)
    and returns a calculated risk level and confidence score.
    """
    req_data = request.get_json() or {}
    
    zone_name = req_data.get('zone_name', 'Amazon Basin Gauge Sector Alpha')
    try:
        rainfall_mm = float(req_data.get('rainfall_mm', 0.0))
        water_level_m = float(req_data.get('water_level_m', 0.0))
    except ValueError:
        return jsonify({"error": "Invalid numerical parameters for rainfall or water level"}), 400
    
    # Calculate risk level based on simple threshold rules
    if water_level_m > 5.0:
        risk = 'CRITICAL'
    elif water_level_m > 3.0:
        risk = 'WARNING'
    else:
        risk = 'NORMAL'
        
    # Generate a realistic-looking confidence score between 70% and 95%
    # Use parameters to anchor seed for stable result patterns
    seed_val = int(water_level_m * 100) + int(rainfall_mm * 10)
    random.seed(seed_val)
    confidence = round(random.uniform(70.0, 95.0), 1)
    
    # Reset random seed behavior so other random calls are not fully deterministic
    random.seed(None)

    return jsonify({
        "zone_name": zone_name,
        "risk": risk,
        "confidence": confidence
    }), 200


# Start server when run directly
if __name__ == '__main__':
    # Flask is running on localhost (127.0.0.1) on port 5000 by default.
    print("Starting Flood Pulse AI Flask Backend...")
    app.run(debug=True, host="127.0.0.1", port=5000)
