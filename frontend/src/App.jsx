import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link, useNavigate, Navigate } from 'react-router-dom';
import './App.css';

// Import Leaflet & React-Leaflet packages for interactive mapping
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';

// Import Firestore & Auth references and functions
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

// Base URL for the Flask backend API
const BACKEND_URL = 'https://nova-squad-backend.onrender.com';

// ==========================================
// Helper function to format relative timestamps ("2 minutes ago", "Just now", etc.)
function getTimeAgo(timestamp, timeRaw) {
  let ms = Date.now();
  if (timestamp?.toMillis) {
    ms = timestamp.toMillis();
  } else if (timestamp?.seconds) {
    ms = timestamp.seconds * 1000;
  } else if (timeRaw) {
    ms = timeRaw;
  }
  
  const diffSecs = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSecs < 60) return 'Just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}

// ==========================================
// ROOT COMPONENT WITH ROUTER
// ==========================================

function HeaderNavbar({ backendHealthy, currentUser, authLoading, notifications = [], readIds = new Set(), onMarkRead, onMarkAllRead }) {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Redirect successfully logged-out users to Login page
      navigate("/login");
    } catch (err) {
      console.error("Sign out process failed: ", err);
    }
  };

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
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
            {/* Dynamic authentication state triggers */}
            {!authLoading && (
              currentUser ? (
                <>
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

                  {/* Bell Icon with Unread Count Badge & Dropdown */}
                  <li className="nav-item" style={{ position: 'relative' }} ref={dropdownRef}>
                    <button 
                      className="notification-bell-btn"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      title="Notifications"
                      aria-label="Notifications"
                    >
                      🔔
                      {unreadCount > 0 && (
                        <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                      )}
                    </button>

                    {dropdownOpen && (
                      <div className="notification-dropdown">
                        <div className="notification-header">
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-bright)' }}>
                            Notifications {unreadCount > 0 && <span style={{ opacity: 0.7 }}>({unreadCount} unread)</span>}
                          </div>
                          {unreadCount > 0 && (
                            <button 
                              className="mark-all-btn"
                              onClick={onMarkAllRead}
                            >
                              Mark all as read
                            </button>
                          )}
                        </div>

                        <div className="notification-list">
                          {notifications.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                              No notifications yet
                            </div>
                          ) : (
                            notifications.map(item => {
                              const isUnread = !readIds.has(item.id);
                              const isReport = item.type === 'New Report';
                              return (
                                <div 
                                  key={item.id} 
                                  className={`notification-item ${isUnread ? 'unread' : ''}`}
                                  onClick={() => onMarkRead(item.id)}
                                >
                                  <div className="notification-item-header">
                                    <span className={`notification-tag ${isReport ? 'report-tag' : 'alert-tag'}`}>
                                      {isReport ? '📝 New Report' : '🚨 Alert'}
                                    </span>
                                    <span className="notification-time">
                                      {getTimeAgo(item.timestamp, item.timeRaw)}
                                    </span>
                                  </div>
                                  <div className="notification-location">
                                    📍 {item.location}
                                  </div>
                                  <div className="notification-details">
                                    {item.severity ? `Severity: ${item.severity.toUpperCase()}` : ''} {item.details ? `— ${item.details}` : ''}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </li>

                  <li className="nav-item" style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="user-email-badge" style={{ margin: '0 8px' }}>
                      👤 {currentUser.email}
                    </span>
                  </li>
                  <li className="nav-item">
                    <button 
                      className="nav-link" 
                      onClick={handleLogout}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}
                    >
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li className="nav-item">
                    <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      Login
                    </NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/signup" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      Signup
                    </NavLink>
                  </li>
                </>
              )
            )}
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
  );
}

// ==========================================
// PROTECTED ROUTE COMPONENT
// ==========================================
function ProtectedRoute({ currentUser, authLoading, children }) {
  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>Loading session...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  // Global backend health status state (checked at root level to show in navbar header)
  const [backendHealthy, setBackendHealthy] = useState(null);

  // Authentication session tracking states
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Emergency Alerts active states
  const [activeAlert, setActiveAlert] = useState(null);
  const [dismissedAlertId, setDismissedAlertId] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

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
    
    // Subscribe to Firebase Authentication session transitions
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return () => {
      clearInterval(interval);
      unsubscribeAuth();
    };
  }, []);

  // Real-time onSnapshot listener for emergency alerts, ordered by timestamp descending, limit to most recent 1
  useEffect(() => {
    const alertsRef = collection(db, 'alerts');
    const q = query(alertsRef, orderBy('timestamp', 'desc'), limit(1));

    const unsubscribeAlerts = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const alertDoc = snapshot.docs[0];
        setActiveAlert({ id: alertDoc.id, ...alertDoc.data() });
      } else {
        setActiveAlert(null);
      }
    }, (error) => {
      console.error("Firestore emergency alerts listener failed: ", error);
    });

    return () => unsubscribeAlerts();
  }, []);

  // Periodically check if the active alert is older than 10 minutes (600,000 ms)
  useEffect(() => {
    const evaluateAlertTime = () => {
      if (!activeAlert) {
        setShowBanner(false);
        return;
      }

      // Hide if the user manually clicked the dismiss (X) button
      if (dismissedAlertId === activeAlert.id) {
        setShowBanner(false);
        return;
      }

      // If the Firestore server timestamp is still pending local write sync, it is brand new
      if (!activeAlert.timestamp) {
        setShowBanner(true);
        return;
      }

      const alertTime = activeAlert.timestamp.toDate();
      const ageMs = Date.now() - alertTime.getTime();
      const maxAgeMs = 10 * 60 * 1000; // 10 minutes

      if (ageMs < maxAgeMs) {
        setShowBanner(true);
      } else {
        setShowBanner(false);
      }
    };

    evaluateAlertTime();
    const interval = setInterval(evaluateAlertTime, 10000); // Poll alert age every 10 seconds

    return () => clearInterval(interval);
  }, [activeAlert, dismissedAlertId]);

  // Real-time notifications listener for citizen_reports & alerts collections
  const [notifications, setNotifications] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      const saved = localStorage.getItem('read_notifications_v1');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleMarkRead = (id) => {
    setReadNotificationIds(prev => {
      const updated = new Set(prev);
      updated.add(id);
      try {
        localStorage.setItem('read_notifications_v1', JSON.stringify(Array.from(updated)));
      } catch (e) { console.error(e); }
      return updated;
    });
  };

  const handleMarkAllRead = () => {
    setReadNotificationIds(prev => {
      const updated = new Set(prev);
      notifications.forEach(n => updated.add(n.id));
      try {
        localStorage.setItem('read_notifications_v1', JSON.stringify(Array.from(updated)));
      } catch (e) { console.error(e); }
      return updated;
    });
  };

  useEffect(() => {
    if (!currentUser) return;

    let reportsList = [];
    let alertsList = [];

    const mergeNotifications = () => {
      const combined = [...reportsList, ...alertsList];
      combined.sort((a, b) => (b.timeRaw || 0) - (a.timeRaw || 0));
      setNotifications(combined.slice(0, 20));
    };

    // 1. Citizen Reports real-time listener (ordered by timestamp desc, limit 20)
    const reportsQuery = query(
      collection(db, 'citizen_reports'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      reportsList = snapshot.docs.map(docItem => {
        const data = docItem.data();
        const timeMs = data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : Date.now());
        return {
          id: `report_${docItem.id}`,
          type: 'New Report',
          location: data.location || 'Incident Area',
          severity: data.severity || 'elevated',
          details: data.details || '',
          timestamp: data.timestamp,
          timeRaw: timeMs
        };
      });
      mergeNotifications();
    }, (err) => console.warn("Citizen reports notification listener warn:", err));

    // 2. Alerts real-time listener (ordered by timestamp desc, limit 20)
    const alertsQuery = query(
      collection(db, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubAlerts = onSnapshot(alertsQuery, (snapshot) => {
      alertsList = snapshot.docs.map(docItem => {
        const data = docItem.data();
        const timeMs = data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : Date.now());
        return {
          id: `alert_${docItem.id}`,
          type: 'Alert',
          location: data.zone || data.location || data.name || 'Risk Zone',
          severity: data.status || data.risk || 'WARNING',
          details: data.message || data.description || data.desc || '',
          timestamp: data.timestamp,
          timeRaw: timeMs
        };
      });
      mergeNotifications();
    }, (err) => {
      // Fallback query on flood_events if alerts collection uses different structure
      const fallbackQuery = query(collection(db, 'flood_events'), limit(20));
      onSnapshot(fallbackQuery, (snapshot) => {
        alertsList = snapshot.docs.map(docItem => {
          const data = docItem.data();
          const timeMs = data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : Date.now());
          return {
            id: `alert_${docItem.id}`,
            type: 'Alert',
            location: data.name || 'Risk Zone',
            severity: data.risk || data.status || 'WARNING',
            details: data.desc || '',
            timestamp: data.timestamp,
            timeRaw: timeMs
          };
        });
        mergeNotifications();
      });
    });

    return () => {
      unsubReports();
      unsubAlerts();
    };
  }, [currentUser]);

  return (
    <Router>
      {/* Header and Navbar containing useNavigate must be a child of Router */}
      <HeaderNavbar 
        backendHealthy={backendHealthy}
        currentUser={currentUser}
        authLoading={authLoading}
        notifications={notifications}
        readIds={readNotificationIds}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
      />

      {/* Global Emergency Alert Banner */}
      {showBanner && activeAlert && (
        <div className="emergency-banner">
          <div className="emergency-banner-content">
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span>
              <strong>EMERGENCY ALERT:</strong> Critical risk detected in <strong>{activeAlert.zone_name}</strong>. {activeAlert.message}
            </span>
          </div>
          <button 
            className="emergency-banner-btn" 
            onClick={() => setDismissedAlertId(activeAlert.id)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Routed Pages Area */}
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/live-map" element={
          <ProtectedRoute currentUser={currentUser} authLoading={authLoading}>
            <LiveMapView />
          </ProtectedRoute>
        } />
        <Route path="/report" element={
          <ProtectedRoute currentUser={currentUser} authLoading={authLoading}>
            <ReportFloodView />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute currentUser={currentUser} authLoading={authLoading}>
            <DashboardView backendHealthy={backendHealthy} />
          </ProtectedRoute>
        } />
        <Route path="/login" element={<LoginView />} />
        <Route path="/signup" element={<SignupView />} />
      </Routes>

      {/* Global Footer */}
      <footer className="app-footer">
        <p>
          Flood Pulse AI • Hydrographic Forecasting and Pulse Analysis Platform • Powered by Flask & React Vite
        </p>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      {!authLoading && (
        <nav className="mobile-navbar">
          <NavLink to="/" end className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <span className="mobile-nav-icon">🏠</span>
            <span>Home</span>
          </NavLink>
          {currentUser ? (
            <>
              <NavLink to="/live-map" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <span className="mobile-nav-icon">🗺️</span>
                <span>Live Map</span>
              </NavLink>
              <NavLink to="/report" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <span className="mobile-nav-icon">📝</span>
                <span>Report</span>
              </NavLink>
              <NavLink to="/dashboard" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <span className="mobile-nav-icon">📊</span>
                <span>Dashboard</span>
              </NavLink>
              <Link to="/login" onClick={() => signOut(auth)} className="mobile-nav-item">
                <span className="mobile-nav-icon">🔓</span>
                <span>Logout</span>
              </Link>
            </>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <span className="mobile-nav-icon">👤</span>
                <span>Login</span>
              </NavLink>
              <NavLink to="/signup" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <span className="mobile-nav-icon">📝</span>
                <span>Signup</span>
              </NavLink>
            </>
          )}
        </nav>
      )}
    </Router>
  );
}

// ==========================================
// LOGIN VIEW (Firebase Email/Password Auth)
// ==========================================

function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect successfully authenticated users to Home page
      navigate("/");
    } catch (err) {
      console.error("Authentication check failed: ", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Invalid email address or password.");
      } else {
        setError("Authentication failed. Please verify credentials and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout panel pulsing-glow">
      <div className="auth-header">
        <h2>Welcome Back</h2>
        <p>Log in to access your forecasting settings and telemetry database.</p>
        {error && (
          <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label" htmlFor="login_email">Email Address</label>
          <input 
            type="email" 
            id="login_email" 
            className="form-input" 
            placeholder="user@example.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login_password">Password</label>
          <input 
            type="password" 
            id="login_password" 
            className="form-input" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            disabled={loading}
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '8px' }} 
          disabled={loading}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="auth-footer">
        Don't have an account? <Link to="/signup">Sign Up</Link>
      </div>
    </div>
  );
}

// ==========================================
// SIGNUP VIEW (Firebase Register + Firestore user record)
// ==========================================

function SignupView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      // Create user credential in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user reference record in Firestore's 'users' collection
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        email: email,
        createdAt: serverTimestamp()
      });

      // Redirect successfully registered users to Home page
      navigate("/");
    } catch (err) {
      console.error("Account registration check failed: ", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email address is already registered.");
      } else {
        setError("Failed to create account. Please verify input formats.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout panel pulsing-glow">
      <div className="auth-header">
        <h2>Create Account</h2>
        <p>Register to participate in forecasting and flood sighting reports.</p>
        {error && (
          <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSignup}>
        <div className="form-group">
          <label className="form-label" htmlFor="signup_email">Email Address</label>
          <input 
            type="email" 
            id="signup_email" 
            className="form-input" 
            placeholder="user@example.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="signup_password">Password (min 6 chars)</label>
          <input 
            type="password" 
            id="signup_password" 
            className="form-input" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="signup_confirm_password">Confirm Password</label>
          <input 
            type="password" 
            id="signup_confirm_password" 
            className="form-input" 
            placeholder="••••••••" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required 
            disabled={loading}
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '8px' }} 
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <div className="auth-footer">
        Already have an account? <Link to="/login">Log In</Link>
      </div>
    </div>
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [formData, setFormData] = useState({
    location: "",
    severity: "",
    email: "",
    details: ""
  });

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

// Helper function to upload image file to ImgBB API with progress tracking
const uploadToImgBB = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const bodyData = new FormData();
    bodyData.append('image', file);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.data && res.data.url) {
            resolve(res.data.url);
          } else {
            reject(new Error(res.error?.message || "ImgBB upload failed"));
          }
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`ImgBB upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during ImgBB image upload"));

    xhr.open('POST', 'https://api.imgbb.com/1/upload?key=c414c205b1db6c4b434019236c6041f9');
    xhr.send(bodyData);
  });
};

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setUploadError("");
    setUploadProgress(0);

    let photoUrl = null;

    // Attempt photo upload to ImgBB if a file is selected
    if (selectedFile) {
      setUploadingPhoto(true);
      try {
        photoUrl = await uploadToImgBB(selectedFile, (progress) => {
          setUploadProgress(progress);
        });
      } catch (err) {
        console.warn("ImgBB photo upload failed, proceeding with report submission without photo:", err);
        setUploadError("Photo upload failed, but your report is being logged.");
        photoUrl = null;
      } finally {
        setUploadingPhoto(false);
      }
    }

    try {
      // Save report details with photoUrl (or null) to Firestore
      const reportsRef = collection(db, 'citizen_reports');
      await addDoc(reportsRef, {
        location: formData.location,
        severity: formData.severity,
        email: formData.email,
        details: formData.details,
        photoUrl: photoUrl || null,
        timestamp: serverTimestamp()
      });

      // Reset form and file state
      setFormData({
        location: "",
        severity: "",
        email: "",
        details: ""
      });
      setSelectedFile(null);
      setSubmitted(true);
    } catch (err) {
      console.error("Firestore error logging incident: ", err);
      setError("Unable to submit report. Please verify connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-layout panel pulsing-glow">
      <div className="form-header">
        <h2>Report Local Incident</h2>
        <p>Help refine our hydrological forecasts by submitting live sightings of flooding or high water conditions.</p>
        {error && (
          <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {submitted ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
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
              value={formData.location}
              onChange={handleChange}
              required 
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="severity">Visual Water Level Severity</label>
            <select 
              id="severity" 
              className="form-select" 
              value={formData.severity}
              onChange={handleChange}
              required
              disabled={submitting}
            >
              <option value="">Choose Severity Option...</option>
              <option value="normal">Normal Baseline (Safe)</option>
              <option value="elevated">Elevated (Flooded Banks)</option>
              <option value="severe">Severe (Inundation of Fields/Roadways)</option>
              <option value="critical">Critical (Levee Overtopping/Evacuating)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Reporter Contact Email</label>
            <input 
              type="email" 
              id="email" 
              className="form-input" 
              placeholder="name@agency.gov" 
              value={formData.email}
              onChange={handleChange}
              required 
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="details">Observations & Observations Details</label>
            <textarea 
              id="details" 
              className="form-textarea" 
              placeholder="Provide a brief description of river state, blockages, or structures affected..."
              value={formData.details}
              onChange={handleChange}
              disabled={submitting}
            ></textarea>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="photo">Sighting Documentation (Photos / Video)</label>
            <div className="upload-zone" style={{ opacity: submitting ? 0.6 : 1, position: 'relative', cursor: 'pointer' }}>
              <input 
                type="file" 
                id="photo" 
                accept="image/*" 
                onChange={handleFileChange}
                disabled={submitting}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: submitting ? 'not-allowed' : 'pointer'
                }}
              />
              <span className="upload-icon">📸</span>
              {selectedFile ? (
                <div style={{ textAlign: 'center' }}>
                  <span className="upload-text" style={{ color: 'var(--text-bright)', fontWeight: 'bold' }}>
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-primary)', marginTop: '4px' }}>
                    Click to change selected photo
                  </span>
                </div>
              ) : (
                <span className="upload-text">Click or drag media files here to attach photo to incident log</span>
              )}
            </div>

            {uploadingPhoto && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Uploading photo to Storage...</span>
                  <span><strong>{uploadProgress}%</strong></span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--color-primary)', transition: 'width 0.2s ease' }}></div>
                </div>
              </div>
            )}

            {uploadError && (
              <div style={{ color: 'var(--color-warning)', fontSize: '12px', marginTop: '6px', fontWeight: '600' }}>
                ⚠️ {uploadError}
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={submitting}
          >
            {submitting ? (uploadingPhoto ? `Uploading Photo (${uploadProgress}%)...` : 'Saving Report...') : 'Submit Incident Sighting'}
          </button>
        </form>
      )}
    </div>
  );
}

// ==========================================
// LIVE MAP VIEW (Vector Hazard Overlays & Firestore)
// ==========================================

// Helper component to center the map when userLoc coordinates resolve
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

function SafeRouteMachine({ start, end, zones, setRouteInfo, setRouteCoords }) {
  const map = useMap();

  useEffect(() => {
    if (!start || !end) {
      setRouteCoords([]);
      setRouteInfo(null);
      return;
    }

    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(start[0], start[1]),
        L.latLng(end[0], end[1])
      ],
      routeWhileDragging: false,
      showAlternatives: false,
      addWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
      createMarker: function() { return null; }, // Hide default markers
      lineOptions: {
        styles: [{ opacity: 0 }] // Hide default line, we render Polyline manually
      }
    }).addTo(map);

    routingControl.on('routesfound', function(e) {
      const routes = e.routes;
      const summary = routes[0].summary;
      const coordinates = routes[0].coordinates;

      let unsafe = false;
      for (const coord of coordinates) {
        for (const zone of zones) {
          const statusStr = ((zone.status || zone.risk || '') + '').toUpperCase();
          const riskStr = ((zone.risk || zone.status || '') + '').toUpperCase();
          const isHazardous = statusStr.includes('CRITICAL') || statusStr.includes('WARNING') || 
                              riskStr.includes('CRITICAL') || riskStr.includes('WARNING') || 
                              statusStr.includes('EVACUATION') || riskStr.includes('MONITORING');

          if (isHazardous) {
            const rawZLat = zone.lat ?? zone.latitude ?? zone.y_coord;
            const rawZLng = zone.lng ?? zone.longitude ?? zone.x_coord;
            if (rawZLat !== undefined && rawZLng !== undefined && rawZLat !== null && rawZLng !== null) {
              const zLat = parseFloat(rawZLat);
              const zLng = parseFloat(rawZLng);
              if (!isNaN(zLat) && !isNaN(zLng)) {
                const dist = map.distance([coord.lat, coord.lng], [zLat, zLng]);
                const threshold = (parseFloat(zone.radius) || 1500) + 500;
                if (dist < threshold) {
                  unsafe = true;
                  break;
                }
              }
            }
          }
        }
        if (unsafe) break;
      }

      setRouteCoords(coordinates.map(c => [c.lat, c.lng]));
      
      let hrs = Math.floor(summary.totalTime / 3600);
      let mins = Math.round((summary.totalTime % 3600) / 60);
      let timeStr = hrs > 0 ? `${hrs} hr ${mins} mins` : `${mins} mins`;

      setRouteInfo({
        distance: (summary.totalDistance / 1000).toFixed(1) + ' km',
        time: timeStr,
        unsafe: unsafe
      });
    });

    return () => {
      try {
        map.removeControl(routingControl);
      } catch (err) {
        console.error("Cleanup routing error:", err);
      }
    };
  }, [map, start, end, zones, setRouteCoords, setRouteInfo]);

  return null;
}

function LiveMapView() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);

  // User location coordinate tracker (defaults to Bengaluru, India coordinates)
  const [userLoc, setUserLoc] = useState([12.9716, 77.5946]);
  const [hasUserLoc, setHasUserLoc] = useState(false);

  const [destInput, setDestInput] = useState('');
  const [startInput, setStartInput] = useState('');
  const [startCoords, setStartCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const fetchUserLocation = () => {
    setIsLocating(true);
    
    const fallbackToIP = async (errorMsg) => {
      console.warn(`Geolocation failed (${errorMsg}). Falling back to IP-based location.`);
      try {
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipData = await ipRes.json();
        if (ipData.latitude && ipData.longitude) {
          setUserLoc([ipData.latitude, ipData.longitude]);
          setHasUserLoc(true);
          setStartInput(`My Location (${ipData.city || 'IP'})`);
          setStartCoords([ipData.latitude, ipData.longitude]);
        } else {
          console.error("IP API returned invalid data:", ipData);
        }
      } catch (err) {
        console.error("IP-based fallback also failed:", err);
      } finally {
        setIsLocating(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLoc([position.coords.latitude, position.coords.longitude]);
          setHasUserLoc(true);
          setStartInput('My Location (GPS)');
          setStartCoords([position.coords.latitude, position.coords.longitude]);
          setIsLocating(false);
        },
        (error) => {
          let msg = "";
          switch(error.code) {
            case error.PERMISSION_DENIED: msg = "User denied the request for Geolocation."; break;
            case error.POSITION_UNAVAILABLE: msg = "Location information is unavailable."; break;
            case error.TIMEOUT: msg = "The request to get user location timed out."; break;
            default: msg = "An unknown error occurred."; break;
          }
          console.error("Geolocation Error:", msg, error);
          fallbackToIP(msg);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    } else {
      console.error("Geolocation Error: Geolocation is not supported by this browser.");
      fallbackToIP("Not supported by browser");
    }
  };

  const handleUseMyLocation = () => {
    fetchUserLocation();
  };

  const handleRouteSearch = async () => {
    if (!destInput || !startInput) return;
    setRouteLoading(true);
    try {
      let resolvedStart = startCoords;
      if (!startInput.startsWith('My Location')) {
        const startRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(startInput)}&format=json`);
        const startData = await startRes.json();
        if (startData && startData.length > 0) {
           resolvedStart = [parseFloat(startData[0].lat), parseFloat(startData[0].lon)];
           setStartCoords(resolvedStart);
        } else {
           alert("Start location not found.");
           setRouteLoading(false);
           return;
        }
      }

      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destInput)}&format=json`);
      const data = await res.json();
      if (data && data.length > 0) {
        setDestinationCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        alert("Destination not found. Please try a different address.");
      }
    } catch (err) {
      console.error(err);
      alert("Error finding location via geocoding.");
    }
    setRouteLoading(false);
  };

  // Request browser geolocation on mount
  useEffect(() => {
    fetchUserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const colRef = collection(db, 'flood_events');

    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        console.log("No documents found in flood_events. Auto-seeding Leaflet map hotspots to Firestore...");
        
        const seedData = [
          {
            id: 'sector_alpha',
            name: 'Amazon Basin Gauge Sector Alpha',
            level: '5.1m',
            status: 'NORMAL',
            risk: 'LOW RISK',
            desc: 'No overtopping detected. Standard river discharge levels.',
            lat: 12.9916,
            lng: 77.5646,
            latitude: 12.9916,
            longitude: 77.5646,
            marker_class: 'healthy-marker'
          },
          {
            id: 'north_delta',
            name: 'North Delta Confluence Zone',
            level: '7.8m',
            status: 'CRITICAL',
            risk: 'CRITICAL EVACUATION',
            desc: 'Water levels exceeding critical flood limits. Evacuating agricultural fields.',
            lat: 12.9516,
            lng: 77.6146,
            latitude: 12.9516,
            longitude: 77.6146,
            marker_class: 'critical-marker'
          },
          {
            id: 'east_tributary',
            name: 'East Tributary Outflow',
            level: '6.4m',
            status: 'WARNING',
            risk: 'ELEVATED MONITORING',
            desc: 'Active runoff and elevated water level. Watching river pulse velocity closely.',
            lat: 13.0016,
            lng: 77.6046,
            latitude: 13.0016,
            longitude: 77.6046,
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
        return;
      }

      const zonesData = [];
      snapshot.forEach((doc) => {
        zonesData.push({ id: doc.id, ...doc.data() });
      });

      console.log("🔥 [Firestore Debug] Raw flood_events fetched from Firestore:", zonesData);

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

    return () => unsubscribe();
  }, []);

  // Helper method to create customized colored Leaflet div markers matching alert severity levels
  const getMarkerIcon = (risk) => {
    const status = (risk || '').toUpperCase();
    const color = status.includes('CRITICAL') ? 'var(--color-danger)' : status.includes('WARNING') ? 'var(--color-warning)' : 'var(--color-success)';
    const shadowColor = status.includes('CRITICAL') ? 'var(--color-danger-glow)' : status.includes('WARNING') ? 'rgba(255, 193, 7, 0.4)' : 'rgba(40, 167, 69, 0.4)';
    
    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `<div style="
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: ${color};
        box-shadow: 0 0 10px ${shadowColor};
        border: 2px solid #fff;
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  };

  return (
    <div className="map-view-grid">
      {/* Map Interactive Canvas */}
      <section className="panel map-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="map-view-header">
          <h2 className="panel-title" style={{ margin: 0 }}>🗺️ Live Leaflet Risk Map</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {loading ? 'Connecting Firestore...' : '🟢 Connected Live'}
          </span>
        </div>

        <div className="map-canvas" style={{ flexGrow: 1, minHeight: '380px', position: 'relative', overflow: 'hidden' }}>
          {/* Leaflet React Map Container */}
          <MapContainer center={userLoc} zoom={12} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* User current location indicator marker */}
            {hasUserLoc && (
              <Marker 
                position={userLoc} 
                icon={L.divIcon({
                  className: 'user-loc-marker',
                  html: `<div style="
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background-color: #00b0ff;
                    box-shadow: 0 0 10px rgba(0, 176, 255, 0.8);
                    border: 2px solid #fff;
                  "></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7]
                })}
              >
                <Popup>
                  <div style={{ color: '#fff', fontSize: '12px' }}>📍 Your Coordinates</div>
                </Popup>
              </Marker>
            )}

            {/* Render Firestore flood_events colored risk zone area overlays */}
            {zones.map((zone) => {
              const rawLat = zone.lat ?? zone.latitude ?? zone.y_coord;
              const rawLng = zone.lng ?? zone.longitude ?? zone.x_coord;
              
              if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) return null;

              const lat = parseFloat(rawLat);
              const lng = parseFloat(rawLng);

              if (isNaN(lat) || isNaN(lng)) return null;

              const statusStr = ((zone.status || zone.risk || '') + '').toUpperCase();
              const riskStr = zone.risk || zone.status || 'LOW RISK';

              const isCritical = statusStr.includes('CRITICAL') || statusStr.includes('EVACUATION');
              const isWarning = statusStr.includes('WARNING') || statusStr.includes('ELEVATED') || statusStr.includes('MONITORING');

              const strokeColor = isCritical ? '#dc3545' : isWarning ? '#e6a100' : '#28a745';
              const fillColor = isCritical ? '#dc3545' : isWarning ? '#ffc107' : '#28a745';

              return (
                <Circle 
                  key={zone.id} 
                  center={[lat, lng]} 
                  radius={zone.radius || 1500}
                  pathOptions={{
                    color: strokeColor,
                    fillColor: fillColor,
                    fillOpacity: isCritical ? 0.40 : isWarning ? 0.35 : 0.28,
                    weight: 2.5,
                    dashArray: isWarning ? '6, 6' : undefined
                  }}
                  eventHandlers={{
                    click: () => setSelectedZone(zone)
                  }}
                >
                  <Tooltip permanent direction="center" className="zone-map-label">
                    <div style={{ textAlign: 'center', lineHeight: '1.2' }}>
                      <div style={{ fontWeight: '700', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                        {zone.name || 'Flood Zone'}
                      </div>
                      <div style={{ 
                        fontSize: '10px', 
                        fontWeight: '800',
                        marginTop: '2px',
                        color: isCritical ? '#ff6b6b' : isWarning ? '#ffe066' : '#51cf66'
                      }}>
                        {riskStr}
                      </div>
                    </div>
                  </Tooltip>

                  <Popup>
                    <div style={{ fontSize: '12.5px', padding: '2px' }}>
                      <h4 style={{ margin: '0 0 6px', fontWeight: '700', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                        {zone.name || 'Flood Event Zone'}
                      </h4>
                      <div style={{ marginBottom: '4px' }}>
                        Water Level: <strong>{zone.level || 'N/A'}</strong>
                      </div>
                      <div>
                        Status: <strong style={{ 
                          color: isCritical ? 'var(--color-danger)' : isWarning ? 'var(--color-warning)' : 'var(--color-success)'
                        }}>{riskStr}</strong>
                      </div>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

            {destinationCoords && startCoords && (
              <SafeRouteMachine 
                start={startCoords} 
                end={destinationCoords} 
                zones={zones} 
                setRouteInfo={setRouteInfo} 
                setRouteCoords={setRouteCoords} 
              />
            )}
            
            {routeCoords.length > 0 && (
              <Polyline 
                positions={routeCoords} 
                color={routeInfo?.unsafe ? '#ff3e3e' : '#00b0ff'} 
                weight={6} 
                opacity={0.8}
                dashArray={routeInfo?.unsafe ? "10, 10" : ""}
              />
            )}

            <ChangeMapView center={userLoc} />
          </MapContainer>

          {/* Canvas Legend overlay */}
          <div className="map-canvas-legend" style={{ zIndex: 1000 }}>
            <span><span className="legend-dot" style={{ background: 'var(--color-success)' }}></span> Normal</span>
            <span><span className="legend-dot" style={{ background: 'var(--color-warning)' }}></span> Warning</span>
            <span><span className="legend-dot" style={{ background: 'var(--color-danger)' }}></span> Critical</span>
          </div>
        </div>
      </section>

      {/* Selected Hotspot Panel */}
      <section className="map-details-container">
        
        {/* Route Search Panel */}
        <div className="panel" style={{ marginBottom: '16px' }}>
          <h3 className="panel-title" style={{ marginBottom: '16px' }}>🗺️ Safe Route Finder</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Location</label>
                <button onClick={handleUseMyLocation} disabled={isLocating} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '11px', cursor: isLocating ? 'not-allowed' : 'pointer', opacity: isLocating ? 0.5 : 1 }}>
                  {isLocating ? '⏳ Locating...' : 'Use GPS'}
                </button>
              </div>
              <input 
                type="text" 
                placeholder="Enter start location..." 
                value={startInput}
                onChange={(e) => {
                  setStartInput(e.target.value);
                  if (e.target.value !== 'My Location (GPS)') setStartCoords(null);
                }}
                style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-muted)', color: 'white', borderRadius: '4px', boxSizing: 'border-box' }} 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Destination</label>
              <input 
                type="text" 
                placeholder="Enter destination address..." 
                value={destInput}
                onChange={(e) => setDestInput(e.target.value)}
                style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-muted)', color: 'white', borderRadius: '4px', boxSizing: 'border-box' }} 
              />
            </div>
            
            <button 
              onClick={handleRouteSearch}
              disabled={routeLoading || !destInput || !startInput}
              style={{ width: '100%', padding: '10px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {routeLoading ? 'Calculating...' : 'Find Safe Route'}
            </button>
            
            {routeInfo && (
              <div style={{ marginTop: '12px', padding: '12px', borderRadius: '4px', background: routeInfo.unsafe ? 'rgba(255, 62, 62, 0.1)' : 'rgba(40, 167, 69, 0.1)', border: `1px solid ${routeInfo.unsafe ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
                {routeInfo.unsafe ? (
                  <p style={{ margin: '0 0 8px', color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '13px' }}>
                    ⚠️ WARNING: This route passes through a risk zone.
                  </p>
                ) : (
                  <p style={{ margin: '0 0 8px', color: 'var(--color-success)', fontWeight: 'bold', fontSize: '13px' }}>
                    ✅ Safe Route: No active flood hazards detected.
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Distance: <strong>{routeInfo.distance}</strong></span>
                  <span>Time: <strong>{routeInfo.time}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
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
  
  // Interactive inputs for the AI flood prediction simulator panel
  const [simInputs, setSimInputs] = useState({
    zone_name: "Amazon Basin Gauge Sector Alpha",
    rainfall_mm: 45.0,
    water_level_m: 2.8
  });
  
  // Calculated prediction output from the AI prediction model
  const [simOutput, setSimOutput] = useState({
    zone_name: "Amazon Basin Gauge Sector Alpha",
    risk: "NORMAL",
    confidence: 84.5
  });

  // Track if prediction has run
  const [hasPredicted, setHasPredicted] = useState(false);
  // Track Firestore save state
  const [firestoreSaved, setFirestoreSaved] = useState(false);

  // OpenWeatherMap Live Weather states
  const [liveWeather, setLiveWeather] = useState({
    isLive: false,
    temp: null,
    humidity: null,
    rainChance: null,
    description: "",
    locationName: "Bengaluru"
  });

  const fetchLiveWeather = async () => {
    const apiKey = "a770b95390e72d4ac82fab668028f53a";
    let url = `https://api.openweathermap.org/data/2.5/weather?q=Bengaluru,IN&units=metric&appid=${apiKey}`;
    let locationName = "Bengaluru, India";

    try {
      if (navigator.geolocation) {
        // Geolocation promise wrapper with timeout to prevent infinite blocking
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 });
        });
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
        locationName = "Your Coordinates";
      }
    } catch (geoError) {
      console.warn("Geolocation prompt skipped or rejected. Falling back to default Bengaluru, India weather metrics.", geoError);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("OpenWeatherMap response error");
      const data = await response.json();
      
      const weatherMain = data.weather?.[0]?.main || "";
      const cloudiness = data.clouds?.all || 0;
      let calculatedRainChance = 0;

      // Estimate rain chance/probability dynamically based on OpenWeatherMap cloud coverage and state values
      if (['Rain', 'Drizzle', 'Thunderstorm'].includes(weatherMain)) {
        calculatedRainChance = weatherMain === 'Rain' ? 95 : weatherMain === 'Thunderstorm' ? 98 : 85;
      } else if (weatherMain === 'Clouds') {
        calculatedRainChance = Math.min(90, Math.round(cloudiness * 0.7));
      } else {
        calculatedRainChance = Math.min(50, Math.round(cloudiness * 0.25));
      }

      setLiveWeather({
        isLive: true,
        temp: Math.round(data.main.temp * 10) / 10,
        humidity: data.main.humidity,
        rainChance: calculatedRainChance,
        description: data.weather?.[0]?.description || "cloudy",
        locationName: data.name || locationName
      });
    } catch (apiError) {
      console.error("Live weather api error, falling back to simulated telemetry: ", apiError);
      setLiveWeather(prev => ({ ...prev, isLive: false }));
    }
  };

  // Fetch updated telemetry from backend
  const fetchTelemetry = async () => {
    setLoadingTelemetry(true);
    fetchLiveWeather(); // Parallel update live weather data
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
        precipitation_mm: +(Math.random() * 32.4).toFixed(1),
        soil_moisture_pct: +(50.0 + Math.random() * 40.0).toFixed(1),
        humidity_pct: +(65.0 + Math.random() * 30.0).toFixed(1),
        station: "Mock River basin sensors v1",
        alert_status: isCritical ? "CRITICAL" : isWarning ? "WARNING" : "NORMAL",
        alert_desc: isCritical 
          ? "CRITICAL swelling detected. Immediate flooding danger!" 
          : isWarning 
            ? "WARNING swelling alert. High water level baseline threshold breached." 
            : "River levels within historical baseline bounds."
      });
    } finally {
      setLoadingTelemetry(false);
    }
  };

  // Writes prediction result to predictions Firestore collection
  const savePredictionToFirestore = async (zoneName, rainfall, waterLevel, risk, confidence) => {
    try {
      const colRef = collection(db, 'predictions');
      await addDoc(colRef, {
        zone_name: zoneName,
        rainfall_mm: rainfall,
        water_level_m: waterLevel,
        risk: risk,
        confidence: confidence,
        timestamp: serverTimestamp()
      });
      setFirestoreSaved(true);
      console.log("Prediction written to Firestore successfully!");
    } catch (err) {
      console.error("Error writing prediction to Firestore: ", err);
    }
  };

  // Submit parameters to backend predict API and save result to Firestore
  const runPredictionSimulation = async (e) => {
    if (e) e.preventDefault();
    setRunningSim(true);
    setFirestoreSaved(false);

    try {
      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_name: simInputs.zone_name,
          rainfall_mm: simInputs.rainfall_mm,
          water_level_m: simInputs.water_level_m
        })
      });
      
      let data;
      if (response.ok) {
        data = await response.json();
      } else {
        throw new Error("Prediction API error");
      }

      setSimOutput({
        zone_name: data.zone_name,
        risk: data.risk,
        confidence: data.confidence
      });
      setHasPredicted(true);

      // Write results to Cloud Firestore predictions collection
      await savePredictionToFirestore(
        data.zone_name, 
        simInputs.rainfall_mm, 
        simInputs.water_level_m, 
        data.risk, 
        data.confidence
      );

      // If simulated risk is CRITICAL, trigger an emergency alert log in Firestore alerts collection
      if (data.risk === 'CRITICAL') {
        try {
          const alertsRef = collection(db, 'alerts');
          await addDoc(alertsRef, {
            zone_name: data.zone_name,
            message: `Hydrological AI model detects critical river swelling bounds! Rainfall: ${simInputs.rainfall_mm}mm, Water level: ${simInputs.water_level_m}m.`,
            severity: 'CRITICAL',
            timestamp: serverTimestamp()
          });
          console.log("Emergency alert published to Firestore alerts collection!");
        } catch (alertErr) {
          console.error("Failed to write emergency alert: ", alertErr);
        }
      }
    } catch (error) {
      console.warn("Prediction API failed. Executing local fallback logic.", error);
      
      // Fallback calculation algorithm matching Flask backend logic
      let calculatedRisk = 'NORMAL';
      if (simInputs.water_level_m > 5.0) {
        calculatedRisk = 'CRITICAL';
      } else if (simInputs.water_level_m > 3.0) {
        calculatedRisk = 'WARNING';
      }

      // Generate stable confidence
      const seedVal = Math.floor(simInputs.water_level_m * 100) + Math.floor(simInputs.rainfall_mm * 10);
      const x = Math.sin(seedVal) * 10000;
      const confidence = +(70.0 + (x - Math.floor(x)) * 25.0).toFixed(1);

      const fallbackData = {
        zone_name: simInputs.zone_name,
        risk: calculatedRisk,
        confidence: confidence
      };

      setSimOutput(fallbackData);
      setHasPredicted(true);

      // Save fallback prediction result to Cloud Firestore
      await savePredictionToFirestore(
        fallbackData.zone_name, 
        simInputs.rainfall_mm, 
        simInputs.water_level_m, 
        fallbackData.risk, 
        fallbackData.confidence
      );

      // If standalone fallback yields a CRITICAL risk, log an emergency alert to Firestore alerts collection
      if (calculatedRisk === 'CRITICAL') {
        try {
          const alertsRef = collection(db, 'alerts');
          await addDoc(alertsRef, {
            zone_name: fallbackData.zone_name,
            message: `Hydrological standalone model detects critical river swelling bounds! Rainfall: ${simInputs.rainfall_mm}mm, Water level: ${simInputs.water_level_m}m. (Standalone Fallback)`,
            severity: 'CRITICAL',
            timestamp: serverTimestamp()
          });
          console.log("Emergency alert published from standalone fallback!");
        } catch (alertErr) {
          console.error("Failed to write standalone fallback emergency alert: ", alertErr);
        }
      }
    } finally {
      setRunningSim(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    fetchLiveWeather();
  }, []);

  const handleInputChange = (field, value) => {
    setSimInputs(prev => ({
      ...prev,
      [field]: field === 'zone_name' ? value : parseFloat(value)
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

          <div className="telemetry-card" style={{ position: 'relative' }}>
            <div className="card-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Precipitation / Weather</span>
              {liveWeather.isLive && (
                <span className="live-badge" style={{
                  fontSize: '9px',
                  background: 'rgba(0, 176, 255, 0.2)',
                  color: 'var(--color-primary)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 176, 255, 0.3)',
                  fontWeight: '700',
                  letterSpacing: '0.5px'
                }}>
                  ● LIVE WEATHER
                </span>
              )}
            </div>
            {liveWeather.isLive ? (
              <div style={{ marginTop: '6px' }}>
                <div className="card-value" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{liveWeather.temp} <span className="card-unit">°C</span></span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400', textTransform: 'capitalize' }}>
                    {liveWeather.description} ({liveWeather.locationName})
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  <div>💧 Humid: <strong>{liveWeather.humidity}%</strong></div>
                  <div>🌧️ Rain: <strong>{liveWeather.rainChance}%</strong></div>
                </div>
              </div>
            ) : (
              <div className="card-value">
                {telemetry.precipitation_mm} <span className="card-unit">mm</span>
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '4px' }}>
                  (Simulated Baseline)
                </span>
              </div>
            )}
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
        <h2 className="panel-title" style={{ marginBottom: '8px' }}>🧠 AI Prediction Simulator</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
          Simulate flood risk by invoking the AI predictive models.
        </p>

        {/* Form Controls */}
        <form onSubmit={runPredictionSimulation}>
          <div className="form-group">
            <label className="form-label" htmlFor="sim_zone_name">Target Zone Name</label>
            <input 
              type="text" 
              id="sim_zone_name" 
              className="form-input" 
              value={simInputs.zone_name}
              onChange={(e) => handleInputChange('zone_name', e.target.value)}
              required
              disabled={runningSim}
            />
          </div>

          <div className="control-group">
            <div className="control-label-row">
              <span>Rainfall Level</span>
              <span className="control-val">{simInputs.rainfall_mm} mm</span>
            </div>
            <input 
              type="range" 
              className="range-slider" 
              min="0" 
              max="150" 
              step="1"
              value={simInputs.rainfall_mm} 
              onChange={(e) => handleInputChange('rainfall_mm', e.target.value)}
              disabled={runningSim}
            />
          </div>

          <div className="control-group">
            <div className="control-label-row">
              <span>Water Level Baseline</span>
              <span className="control-val">{simInputs.water_level_m} m</span>
            </div>
            <input 
              type="range" 
              className="range-slider" 
              min="0" 
              max="10" 
              step="0.1"
              value={simInputs.water_level_m} 
              onChange={(e) => handleInputChange('water_level_m', e.target.value)}
              disabled={runningSim}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '8px' }} 
            disabled={runningSim}
          >
            {runningSim ? 'Running AI Model...' : '🧠 Run Prediction'}
          </button>
        </form>

        {/* Prediction Output Results */}
        {hasPredicted && (
          <div className="prediction-output-card" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Prediction Result
              </span>
              {firestoreSaved && (
                <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '600' }}>
                  ✓ Saved to Firestore
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Forecast for <strong>{simOutput.zone_name}</strong>
              </div>
              <span className={`alert-indicator ${simOutput.risk}`} style={{ fontSize: '18px', padding: '10px 24px', borderRadius: '8px' }}>
                {simOutput.risk}
              </span>
            </div>

            <div className="prediction-stats" style={{ gridTemplateColumns: '1fr' }}>
              <div className="stat-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label" style={{ margin: 0 }}>Model Confidence</span>
                <span className="stat-val" style={{ color: 'var(--color-primary)', fontWeight: '700' }}>{simOutput.confidence}%</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
