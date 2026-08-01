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
    Accepts simulation parameters (precipitation, upstream release, soil moisture)
    and returns a calculated flood probability and risk level.
    """
    req_data = request.get_json() or {}
    
    # Retrieve inputs with safe defaults
    precipitation = float(req_data.get('precipitation', 20.0))
    upstream_release = float(req_data.get('upstream_release', 100.0))
    soil_moisture = float(req_data.get('soil_moisture', 50.0))
    
    # Simple algorithmic calculation representing the AI inference logic
    base_factor = (precipitation * 1.5) + (upstream_release * 0.3) + (soil_moisture * 0.8)
    # Scale between 0% and 100%
    probability = min(100.0, max(0.0, round(base_factor / 3.5, 1)))
    
    if probability > 80.0:
        risk_level = "CRITICAL"
        color = "#ff3e3e"
    elif probability > 50.0:
        risk_level = "HIGH"
        color = "#ffa600"
    elif probability > 25.0:
        risk_level = "MODERATE"
        color = "#e8c800"
    else:
        risk_level = "LOW"
        color = "#00e676"

    return jsonify({
        "success": True,
        "input_summary": {
            "precipitation_mm": precipitation,
            "upstream_release_m3s": upstream_release,
            "soil_moisture_pct": soil_moisture
        },
        "prediction": {
            "flood_probability_pct": probability,
            "risk_level": risk_level,
            "risk_color": color,
            "estimated_inundation_depth_m": round(max(0.0, (probability - 20) * 0.05), 2),
            "recommended_action": "Reinforce levees and restrict access" if probability > 50 else "Standard monitoring protocol"
        }
    }), 200

# Start server when run directly
if __name__ == '__main__':
    # Flask is running on localhost (127.0.0.1) on port 5000 by default.
    print("Starting Flood Pulse AI Flask Backend...")
    app.run(debug=True, host="127.0.0.1", port=5000)
