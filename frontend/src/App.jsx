import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link } from 'react-router-dom';
import './App.css';

// Import Firestore reference and functions
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

// Base URL for the Flask backend API
const BACKEND_URL = 'http://localhost:5000';

// ==========================================
// ROOT COMPONENT WITH ROUTER
// ==========================================

function App() {
  // Global backend health status state (checked at root level to show in navbar header)
  const [backendHealthy, setBackendHealthy] = useState(null);

  // Poll backend health status
  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      if (response.ok) {
        const data = await response.json();
        setBackendHealthy(data.status === 'healthy');
      } else {
        setBackendHealthy(false);
      }
    } catch (error) {
      console.warn("Backend not reachable. Dashboard will run in Standalone mode.");
      setBackendHealthy(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      {/* App Header & Navbar */}
      <header className="app-header">
        <div className="brand-section">
          <h1>
            🌊 Flood Pulse AI <span className="brand-badge">Engine v1.0</span>
          </h1>
        </div>

        <div className="header-actions">
          {/* Navigation Bar */}
          <nav className="navbar">
            <ul className="nav-list">
              <li className="nav-item">
                <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Home
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/live-map" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Live Map
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/report" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Report Flood
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Dashboard
                </NavLink>
              </li>
            </ul>
          </nav>

          {/* Backend Connectivity Status Dot */}
          <div className="status-badge">
            <span className={`status-dot ${backendHealthy ? 'healthy' : 'unhealthy'}`}></span>
            <span>
              Backend: {backendHealthy === null ? 'Checking...' : backendHealthy ? 'Connected' : 'Standalone'}
            </span>
          </div>
        </div>
      </header>

      {/* Routed Pages Area */}
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/live-map" element={<LiveMapView />} />
        <Route path="/report" element={<ReportFloodView />} />
        <Route path="/dashboard" element={<DashboardView backendHealthy={backendHealthy} />} />
      </Routes>

      {/* Global Footer */}
      <footer className="app-footer">
        <p>
          Flood Pulse AI • Hydrographic Forecasting and Pulse Analysis Platform • Powered by Flask & React Vite
        </p>
      </footer>
    </Router>
  );
}

// ==========================================
// HOME VIEW (Introductory Landing Layout)
// ==========================================

function HomeView() {
  return (
    <div className="home-layout">
      {/* Banner / Hero Section */}
      <section className="home-hero pulsing-glow">
        <h2 className="home-title">Predicting river pulses, protecting basin communities</h2>
        <p className="home-subtitle">
          Flood Pulse AI is a hydrology forecasting platform utilizing mock predictive neural engines to monitor river swelling patterns, upstream water discharges, and soil moisture levels. Assess risks and plan ahead.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/dashboard" className="btn btn-primary">
            🚀 Open Analytics Dashboard
          </Link>
          <Link to="/live-map" className="btn btn-secondary">
            🗺️ View Flood Map
          </Link>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section className="info-grid">
        <div className="info-card">
          <span className="card-icon">📡</span>
          <h3 className="card-title">Hydrological Monitoring</h3>
          <p className="card-desc">
            Aggregates live sensor telemetry including real-time water levels, discharge volumes, precipitation depth, and land saturation levels.
          </p>
        </div>
        <div className="info-card">
          <span className="card-icon">🧠</span>
          <h3 className="card-title">AI Predictive Simulator</h3>
          <p className="card-desc">
            Run custom models adjusting upstream release and humidity variables. Get risk calculations and inundation forecasts.
          </p>
        </div>
        <div className="info-card">
          <span className="card-icon">📣</span>
          <h3 className="card-title">Incident Crowdsourcing</h3>
          <p className="card-desc">
            Enables regional emergency contacts and local citizens to report flood sightings to calibrate automated risk maps.
          </p>
        </div>
      </section>
    </div>
  );
}

// ==========================================
// REPORT FLOOD VIEW (Sightings Form Layout)
// ==========================================

function ReportFloodView() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="report-layout panel pulsing-glow">
      <div className="form-header">
        <h2>Report Local Incident</h2>
        <p>Help refine our hydrological forecasts by submitting live sightings of flooding or high water conditions.</p>
      </div>

      {submitted ? (
        <div style={{ textalign: 'center', padding: '32px 0' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>✅</span>
          <h3 style={{ color: 'var(--text-bright)' }}>Report Logged</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            Thank you. Your sighting details have been queued for processing.
          </p>
          <button className="btn btn-secondary" onClick={() => setSubmitted(false)}>
            Submit Another Report
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="location">Incident Location / Area</label>
            <input 
              type="text" 
              id="location" 
              className="form-input" 
              placeholder="e.g. Rio Negro Bridge Crossing (KM 12)" 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="severity">Visual Water Level Severity</label>
            <select id="severity" className="form-select" required>
              <option value="">Choose Severity Option...</option>
              <option value="normal">Normal Baseline (Safe)</option>
              <option value="elevated">Elevated (Flooded Banks)</option>
              <option value="severe">Severe (Inundation of Fields/Roadways)</option>
              <option value="critical">Critical (Levee Overtopping/Evacuating)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reporter">Reporter Contact Email</label>
            <input 
              type="email" 
              id="reporter" 
              className="form-input" 
              placeholder="name@agency.gov" 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="details">Observations & Observations Details</label>
            <textarea 
              id="details" 
              className="form-textarea" 
              placeholder="Provide a brief description of river state, blockages, or structures affected..."
            ></textarea>
          </div>

          <div className="form-group">
            <label className="form-label">Sighting Documentation (Photos / Video)</label>
            <div className="upload-zone">
              <span className="upload-icon">📸</span>
              <span className="upload-text">Click or drag media files here to attach to incident log</span>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Submit Incident Sighting
          </button>
        </form>
      )}
    </div>
  );
}

// ==========================================
// LIVE MAP VIEW (Vector Hazard Overlays & Firestore)
// ==========================================

function LiveMapView() {
  // State variables for firestore indicators
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);

  useEffect(() => {
    // Reference the 'flood_events' collection in Firestore
    const colRef = collection(db, 'flood_events');

    // Establish real-time onSnapshot listener for instant updates
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      // If collection is empty, auto-seed the default markers
      if (snapshot.empty) {
        console.log("No documents found in flood_events. Auto-seeding default markers to Firestore...");
        
        const seedData = [
          {
            id: 'sector_alpha',
            name: 'Amazon Basin Gauge Sector Alpha',
            level: '5.1m',
            status: 'NORMAL',
            risk: 'LOW RISK',
            desc: 'No overtopping detected. Standard river discharge levels.',
            x_coord: 25,
            y_coord: 25,
            marker_class: 'healthy-marker'
          },
          {
            id: 'north_delta',
            name: 'North Delta Confluence Zone',
            level: '7.8m',
            status: 'CRITICAL',
            risk: 'CRITICAL EVACUATION',
            desc: 'Water levels exceeding critical flood limits. Evacuating agricultural fields.',
            x_coord: 55,
            y_coord: 45,
            marker_class: 'critical-marker'
          },
          {
            id: 'east_tributary',
            name: 'East Tributary Outflow',
            level: '6.4m',
            status: 'WARNING',
            risk: 'ELEVATED MONITORING',
            desc: 'Active runoff and elevated water level. Watching river pulse velocity closely.',
            x_coord: 75,
            y_coord: 25,
            marker_class: 'warning-marker'
          }
        ];

        seedData.forEach(async (zone) => {
          const docRef = doc(db, 'flood_events', zone.id);
          try {
            await setDoc(docRef, zone);
          } catch (err) {
            console.error("Auto-seeding error writing doc: ", err);
          }
        });
        return; // setDoc operations will trigger onSnapshot again with seedData
      }

      const zonesData = [];
      snapshot.forEach((doc) => {
        zonesData.push({ id: doc.id, ...doc.data() });
      });

      setZones(zonesData);

      // Select default or keep updated selected marker details active
      if (zonesData.length > 0) {
        setSelectedZone((prev) => {
          if (!prev || !zonesData.some((z) => z.id === prev.id)) {
            return zonesData[0];
          }
          return zonesData.find((z) => z.id === prev.id);
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore live stream onSnapshot listener failed: ", error);
      setLoading(false);
    });

    // Cleanup real-time stream subscription on component unmount
    return () => unsubscribe();
  }, []);

  return (
    <div className="map-view-grid">
      {/* Map Interactive Canvas */}
      <section className="panel map-card">
        <div className="map-view-header">
          <h2 className="panel-title" style={{ margin: 0 }}>🗺️ Live Risk Map</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {loading ? 'Connecting Firestore...' : '🟢 Connected Live'}
          </span>
        </div>

        <div className="map-canvas">
          {/* Grid Background */}
          <div className="map-grid-layer"></div>

          {/* Blur overlays for flood zones */}
          <div className="map-zone-overlay zone-critical"></div>
          <div className="map-zone-overlay zone-warning"></div>
          <div className="map-zone-overlay zone-safe"></div>

          {/* SVG river channels path */}
          <svg className="map-river-vector">
            <path d="M 50 10 Q 150 180, 220 220 T 380 480" className="map-river-line" />
            <path d="M 220 220 Q 300 120, 420 80" className="map-river-line" style={{ strokeWidth: '3px' }} />
          </svg>

          {/* Hotspot Markers streamed from Firestore */}
          {zones.map((zone) => (
            <div 
              key={zone.id}
              className={`map-marker ${zone.marker_class || 'healthy-marker'}`} 
              style={{ left: `${zone.x_coord}%`, top: `${zone.y_coord}%` }}
              onClick={() => setSelectedZone(zone)}
            >
              <div className="marker-inner"></div>
            </div>
          ))}

          {/* Canvas Legend overlay */}
          <div className="map-canvas-legend">
            <span><span className="legend-dot" style={{ background: 'var(--color-success)' }}></span> Normal</span>
            <span><span className="legend-dot" style={{ background: 'var(--color-warning)' }}></span> Warning</span>
            <span><span className="legend-dot" style={{ background: 'var(--color-danger)' }}></span> Critical</span>
          </div>
        </div>
      </section>

      {/* Selected Hotspot Panel */}
      <section className="map-details-container">
        <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h3 className="panel-title" style={{ marginBottom: '16px' }}>📍 Zone Information</h3>
          
          {selectedZone ? (
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h4 style={{ margin: '0 0 4px', color: 'var(--text-bright)' }}>{selectedZone.name}</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 16px' }}>
                Current Level: <strong style={{ color: 'var(--text-bright)' }}>{selectedZone.level}</strong>
              </p>
              <p style={{ fontSize: '13.5px', color: 'var(--text-main)', lineHeight: '1.5', margin: '0 0 16px' }}>
                {selectedZone.desc}
              </p>
              <div>
                <span className={`alert-indicator ${selectedZone.status || 'NORMAL'}`}>
                  {selectedZone.risk || 'LOW RISK'}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
              {loading ? 'Connecting to database...' : 'No telemetry points available.'}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '16px', marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Map hotspots synced to Cloud Firestore in real-time.
          </div>
        </div>
      </section>
    </div>
  );
}

// ==========================================
// ANALYTICS & SIMULATOR DASHBOARD VIEW
// ==========================================

function DashboardView({ backendHealthy }) {
  // Current telemetry readings from the river basin sensors
  const [telemetry, setTelemetry] = useState({
    water_level_m: 4.85,
    flow_rate_m3s: 875.4,
    precipitation_mm: 12.5,
    soil_moisture_pct: 62.1,
    humidity_pct: 82.0,
    station: "Amazon Basin Gauging Station #12",
    alert_status: "NORMAL",
    alert_desc: "River levels within historical baseline bounds."
  });
  
  // Loading states
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [runningSim, setRunningSim] = useState(false);
  
  // Interactive inputs for the AI flood pulse simulation panel
  const [simInputs, setSimInputs] = useState({
    precipitation: 45.0,
    upstream_release: 250.0,
    soil_moisture: 75.0
  });
  
  // Calculated prediction output from the AI simulation model
  const [simOutput, setSimOutput] = useState({
    flood_probability_pct: 42.8,
    risk_level: "MODERATE",
    risk_color: "#e8c800",
    estimated_inundation_depth_m: 1.14,
    recommended_action: "Enhanced monitoring protocol and alert local response units"
  });

  // Fetch updated telemetry from backend
  const fetchTelemetry = async () => {
    setLoadingTelemetry(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/telemetry`);
      if (response.ok) {
        const data = await response.json();
        setTelemetry({
          water_level_m: data.data.water_level_m,
          flow_rate_m3s: data.data.flow_rate_m3s,
          precipitation_mm: data.data.precipitation_mm,
          soil_moisture_pct: data.data.soil_moisture_pct,
          humidity_pct: data.data.humidity_pct,
          station: data.station,
          alert_status: data.alert.status,
          alert_desc: data.alert.description
        });
      } else {
        throw new Error("Failed telemetry call");
      }
    } catch (error) {
      console.warn("Generating local mock telemetry.");
      const waterLevel = +(3.5 + Math.random() * 4.3).toFixed(2);
      const isCritical = waterLevel > 7.0;
      const isWarning = waterLevel > 5.5 && waterLevel <= 7.0;
      setTelemetry({
        water_level_m: waterLevel,
        flow_rate_m3s: +(waterLevel * 180.5 + (Math.random() * 20 - 10)).toFixed(1),
        precipitation_mm: +(Math.random() * 50).toFixed(1),
        soil_moisture_pct: +(40 + Math.random() * 55).toFixed(1),
        humidity_pct: +(70 + Math.random() * 29).toFixed(1),
        station: "Amazon Basin Gauging Station #12 (Offline)",
        alert_status: isCritical ? "CRITICAL" : isWarning ? "WARNING" : "NORMAL",
        alert_desc: isCritical 
          ? "Water levels exceed critical flood line. Evacuation recommended." 
          : isWarning 
            ? "Elevated water levels. Monitoring river pulses closely." 
            : "River levels within historical baseline bounds."
      });
    } finally {
      setLoadingTelemetry(false);
    }
  };

  // Submit parameter adjustments to the backend's AI model to run prediction
  const runPredictionSimulation = async () => {
    setRunningSim(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precipitation: simInputs.precipitation,
          upstream_release: simInputs.upstream_release,
          soil_moisture: simInputs.soil_moisture
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSimOutput({
          flood_probability_pct: data.prediction.flood_probability_pct,
          risk_level: data.prediction.risk_level,
          risk_color: data.prediction.risk_color,
          estimated_inundation_depth_m: data.prediction.estimated_inundation_depth_m,
          recommended_action: data.prediction.recommended_action
        });
      } else {
        throw new Error("Prediction API error");
      }
    } catch (error) {
      // Fallback calculation algorithm (matching Flask backend logic)
      const baseFactor = (simInputs.precipitation * 1.5) + (simInputs.upstream_release * 0.3) + (simInputs.soil_moisture * 0.8);
      const probability = Math.min(100.0, Math.max(0.0, +(baseFactor / 3.5).toFixed(1)));
      
      let riskLevel = "LOW";
      let riskColor = "#00e676";
      if (probability > 80.0) {
        riskLevel = "CRITICAL";
        riskColor = "#ff3e3e";
      } else if (probability > 50.0) {
        riskLevel = "HIGH";
        riskColor = "#ffa600";
      } else if (probability > 25.0) {
        riskLevel = "MODERATE";
        riskColor = "#e8c800";
      }

      setSimOutput({
        flood_probability_pct: probability,
        risk_level: riskLevel,
        risk_color: riskColor,
        estimated_inundation_depth_m: +(Math.max(0, (probability - 20) * 0.05)).toFixed(2),
        recommended_action: probability > 50 
          ? "Reinforce critical levee infrastructure and restrict entry" 
          : "Standard monitoring protocol"
      });
    } finally {
      setRunningSim(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  // Update simulation outputs dynamically when inputs change
  useEffect(() => {
    runPredictionSimulation();
  }, [simInputs.precipitation, simInputs.upstream_release, simInputs.soil_moisture]);

  const handleInputChange = (field, value) => {
    setSimInputs(prev => ({
      ...prev,
      [field]: parseFloat(value)
    }));
  };

  // Map water level height to SVG wave coordinates
  const baseWaterLevelHeight = 220;
  const maxSafeLevel = 8.0;
  const minSafeLevel = 3.0;
  const percentageFilled = Math.min(100, Math.max(0, ((telemetry.water_level_m - minSafeLevel) / (maxSafeLevel - minSafeLevel)) * 100));
  const waveYCoord = baseWaterLevelHeight - (percentageFilled * baseWaterLevelHeight / 100);

  return (
    <main className="dashboard-grid">
      {/* Left Side: Sensor Telemetry Widget */}
      <section className="panel pulsing-glow">
        <div className="panel-header">
          <h2 className="panel-title">📡 Real-Time Hydrology Telemetry</h2>
          <button 
            className="btn btn-secondary" 
            onClick={fetchTelemetry}
            disabled={loadingTelemetry}
          >
            {loadingTelemetry ? 'Refreshing Sensors...' : '🔄 Poll Sensors'}
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
          Telemetry readings from <strong>{telemetry.station}</strong>.
        </p>

        {/* Telemetry Gauge Cards */}
        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="card-label">Water Level</div>
            <div className="card-value">
              {telemetry.water_level_m} <span className="card-unit">m</span>
            </div>
          </div>

          <div className="telemetry-card">
            <div className="card-label">River Discharge</div>
            <div className="card-value">
              {telemetry.flow_rate_m3s} <span className="card-unit">m³/s</span>
            </div>
          </div>

          <div className="telemetry-card">
            <div className="card-label">Precipitation</div>
            <div className="card-value">
              {telemetry.precipitation_mm} <span className="card-unit">mm</span>
            </div>
          </div>

          <div className="telemetry-card">
            <div className="card-label">Soil Moisture</div>
            <div className="card-value">
              {telemetry.soil_moisture_pct} <span className="card-unit">%</span>
            </div>
          </div>
        </div>

        {/* Hydrographic Visualizer Panel */}
        <div className="visualizer-container">
          <div className="sensor-node" style={{ left: '30%', bottom: `${Math.min(90, Math.max(10, percentageFilled))}%` }}></div>
          <div className="sensor-node" style={{ left: '75%', bottom: `${Math.min(90, Math.max(10, percentageFilled - 5))}%` }}></div>
          
          <svg className="river-svg" preserveAspectRatio="none" viewBox="0 0 400 220">
            <defs>
              <linearGradient id="river-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(0, 176, 255, 0.75)" />
                <stop offset="100%" stopColor="rgba(10, 12, 16, 0.95)" />
              </linearGradient>
            </defs>
            
            <path 
              className="river-fill river-wave"
              d={`M 0 ${waveYCoord} 
                  Q 100 ${waveYCoord - 10}, 200 ${waveYCoord} 
                  T 400 ${waveYCoord} 
                  L 400 220 L 0 220 Z`}
            />
            <path 
              className="river-fill"
              opacity="0.4"
              d={`M 0 ${waveYCoord + 8} 
                  Q 120 ${waveYCoord - 2}, 240 ${waveYCoord + 5} 
                  T 400 ${waveYCoord + 8} 
                  L 400 220 L 0 220 Z`}
            />
          </svg>
        </div>

        {/* Active Hydrological Alerts Callout */}
        <div className="alert-callout">
          <span className={`alert-indicator ${telemetry.alert_status}`}>
            {telemetry.alert_status}
          </span>
          <div className="alert-message">
            <strong>System Status:</strong> {telemetry.alert_desc}
          </div>
        </div>
      </section>

      {/* Right Side: AI Flood Risk Simulator */}
      <section className="panel">
        <h2 className="panel-title" style={{ marginBottom: '8px' }}>🧠 AI Pulse Simulator</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
          Simulate river basin response to extreme precipitation and release factors.
        </p>

        {/* Slider Inputs */}
        <div className="control-group">
          <div className="control-label-row">
            <span>Precipitation Level</span>
            <span className="control-val">{simInputs.precipitation} mm</span>
          </div>
          <input 
            type="range" 
            className="range-slider" 
            min="0" 
            max="150" 
            step="1"
            value={simInputs.precipitation} 
            onChange={(e) => handleInputChange('precipitation', e.target.value)}
          />
        </div>

        <div className="control-group">
          <div className="control-label-row">
            <span>Upstream Levee Release</span>
            <span className="control-val">{simInputs.upstream_release} m³/s</span>
          </div>
          <input 
            type="range" 
            className="range-slider" 
            min="50" 
            max="800" 
            step="10"
            value={simInputs.upstream_release} 
            onChange={(e) => handleInputChange('upstream_release', e.target.value)}
          />
        </div>

        <div className="control-group">
          <div className="control-label-row">
            <span>Catchment Soil Moisture</span>
            <span className="control-val">{simInputs.soil_moisture} %</span>
          </div>
          <input 
            type="range" 
            className="range-slider" 
            min="10" 
            max="100" 
            step="1"
            value={simInputs.soil_moisture} 
            onChange={(e) => handleInputChange('soil_moisture', e.target.value)}
          />
        </div>

        {/* Prediction Output Results */}
        <div className="prediction-output-card">
          <div className="prediction-probability-display">
            <div className="gauge-circle-outer" style={{ background: `conic-gradient(${simOutput.risk_color} ${simOutput.flood_probability_pct * 3.6}deg, rgba(255,255,255,0.05) 0deg)` }}>
              <div className="gauge-circle-inner">
                <span className="gauge-percentage">{simOutput.flood_probability_pct}%</span>
                <span className="gauge-label">Risk Probability</span>
              </div>
            </div>
            <div>
              <span className="brand-badge" style={{ backgroundColor: `${simOutput.risk_color}22`, color: simOutput.risk_color, borderColor: `${simOutput.risk_color}44` }}>
                {simOutput.risk_level} RISK
              </span>
            </div>
          </div>

          <div className="prediction-stats">
            <div className="stat-item">
              <div className="stat-label">Inundation Depth</div>
              <div className="stat-val">{simOutput.estimated_inundation_depth_m} m</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Response Action</div>
              <div className="stat-val" style={{ fontSize: '11px', lineHeight: '1.2' }}>{simOutput.recommended_action}</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
