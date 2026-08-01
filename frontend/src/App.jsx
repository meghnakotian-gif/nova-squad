import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link, useNavigate, Navigate } from 'react-router-dom';
import './App.css';

// Import Leaflet & React-Leaflet packages for interactive mapping
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle, Polygon, Tooltip } from 'react-leaflet';
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
  updateDoc,
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

// Hardcoded municipal authority email accounts for Role-Based Access Control (RBAC)
const AUTHORITY_EMAILS = [
  'govmuncipalty@gmail.com',
  'govmangluru@gmail.com',
  'govbanglore@gmail.com'
];

export const getRoleForEmail = (email) => {
  if (!email) return 'citizen';
  const cleanEmail = email.trim().toLowerCase();
  return AUTHORITY_EMAILS.some(a => a.toLowerCase() === cleanEmail) ? 'authority' : 'citizen';
};

// Import translation dictionary for multi-language support (English, Kannada, Hindi, Tulu, Malayalam)
import { translations } from './translations';

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

function HeaderNavbar({ backendHealthy, currentUser, userRole, authLoading, notifications = [], readIds = new Set(), onMarkRead, onMarkAllRead, lang, setLang, t }) {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileDropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Redirect successfully logged-out users to Home page
      navigate("/");
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
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(e.target)) {
        setMobileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-title-row">
          <h1>
            🌊 {t.brand || "NOVA Flood Squad"} <span className="brand-badge">Engine v1.0</span>
          </h1>

          {/* Mobile Top Header Actions (Language Selector & Notification Bell) */}
          <div className="mobile-header-actions">
            <select 
              value={lang} 
              onChange={(e) => {
                const selected = e.target.value;
                setLang(selected);
                localStorage.setItem('appLanguage', selected);
              }}
              className="language-selector-dropdown mobile-lang-select"
              title="Select Language"
              aria-label="Select Language"
            >
              <option value="en">🌐 English</option>
              <option value="kn">🌐 ಕನ್ನಡ</option>
              <option value="hi">🌐 हिन्दी</option>
              <option value="tcy">🌐 ತುಳು</option>
              <option value="ml">🌐 മലയാളം</option>
            </select>

            {!authLoading && currentUser && (
              <div style={{ position: 'relative' }} ref={mobileDropdownRef}>
                <button 
                  className="notification-bell-btn mobile-bell-btn"
                  onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
                  title="Notifications"
                  aria-label="Notifications"
                >
                  🔔
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </button>

                {mobileDropdownOpen && (
                  <div className="notification-dropdown mobile-notification-dropdown">
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
                              onClick={() => {
                                onMarkRead(item.id);
                                setMobileDropdownOpen(false);
                              }}
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
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="header-actions">
        {/* Navigation Bar */}
        <nav className="navbar">
          <ul className="nav-list">
            {/* Language Selector Dropdown (visible on all pages) */}
            <li className="nav-item">
              <select 
                value={lang} 
                onChange={(e) => {
                  const selected = e.target.value;
                  setLang(selected);
                  localStorage.setItem('appLanguage', selected);
                }}
                className="language-selector-dropdown"
                title="Select Language"
                aria-label="Select Language"
              >
                <option value="en">🌐 English</option>
                <option value="kn">🌐 ಕನ್ನಡ (Kannada)</option>
                <option value="hi">🌐 हिन्दी (Hindi)</option>
                <option value="tcy">🌐 ತುಳು (Tulu)</option>
                <option value="ml">🌐 മലയാളം (Malayalam)</option>
              </select>
            </li>

            <li className="nav-item">
              <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                {t.home || 'Home'}
              </NavLink>
            </li>
            {/* Dynamic authentication state triggers */}
            {!authLoading && (
              currentUser ? (
                <>
                  <li className="nav-item">
                    <NavLink to="/live-map" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      {t.liveMap || 'Live Map'}
                    </NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/report" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      {t.reportFlood || 'Report Incident'}
                    </NavLink>
                  </li>
                  {userRole === 'authority' && (
                    <li className="nav-item">
                      <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        {t.dashboard || 'Dashboard'}
                      </NavLink>
                    </li>
                  )}

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

                  <li className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="user-email-badge" style={{ margin: '0 4px' }}>
                      👤 {currentUser.email}
                    </span>
                    {userRole === 'authority' && (
                      <span className="authority-badge" title="Municipal Authority Access Granted" style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, rgba(0, 176, 255, 0.25), rgba(0, 230, 118, 0.25))',
                        color: '#00e676',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        border: '1px solid rgba(0, 230, 118, 0.4)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        letterSpacing: '0.3px',
                        boxShadow: '0 0 10px rgba(0, 230, 118, 0.2)'
                      }}>
                        🏛️ {t.municipalAuthority || 'Municipal Authority'}
                      </span>
                    )}
                  </li>
                  <li className="nav-item">
                    <button 
                      className="nav-link" 
                      onClick={handleLogout}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}
                    >
                      {t.logout || 'Logout'}
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li className="nav-item">
                    <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      {t.login || 'Login'}
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
// PROTECTED ROUTE COMPONENT (Handles Role-Based Access Control)
// ==========================================
function ProtectedRoute({ currentUser, authLoading, userRole, requiredRole, children }) {
  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>Loading session...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  // Global backend health status state (checked at root level to show in navbar header)
  const [backendHealthy, setBackendHealthy] = useState(null);

  // Authentication session tracking states
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('citizen');
  const [authLoading, setAuthLoading] = useState(true);

  // Multi-language localization state (persisted in localStorage, defaults to English)
  const [lang, setLang] = useState(() => localStorage.getItem('appLanguage') || 'en');
  const t = translations[lang] || translations.en;

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
    
    // Subscribe to Firebase Authentication session transitions & sync user roles
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const role = getRoleForEmail(user.email);
        setUserRole(role);
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            email: user.email,
            role: role,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn("Firestore user role sync warning:", err);
        }
      } else {
        setUserRole('citizen');
      }
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
      <HeaderNavbar 
        backendHealthy={backendHealthy} 
        currentUser={currentUser}
        userRole={userRole} 
        authLoading={authLoading}
        notifications={notifications}
        readIds={readNotificationIds}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        lang={lang}
        setLang={setLang}
        t={t}
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
        <Route path="/" element={<HomeView t={t} />} />
        <Route path="/live-map" element={
          <ProtectedRoute currentUser={currentUser} authLoading={authLoading} userRole={userRole}>
            <LiveMapView t={t} />
          </ProtectedRoute>
        } />
        <Route path="/report" element={
          <ProtectedRoute currentUser={currentUser} authLoading={authLoading} userRole={userRole}>
            <ReportFloodView t={t} />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute currentUser={currentUser} authLoading={authLoading} userRole={userRole} requiredRole="authority">
            <DashboardView backendHealthy={backendHealthy} t={t} />
          </ProtectedRoute>
        } />
        <Route path="/login" element={<LoginView t={t} />} />
        <Route path="/signup" element={<SignupView t={t} />} />
      </Routes>

      {/* Global Footer */}
      <footer className="app-footer">
        <p>
          {t.footerText || 'Flood Pulse AI • Hydrographic Forecasting and Pulse Analysis Platform • Powered by Flask & React Vite'}
        </p>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      {!authLoading && (
        <nav className="mobile-navbar">
          <NavLink to="/" end className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <span className="mobile-nav-icon">🏠</span>
            <span>{t.home || 'Home'}</span>
          </NavLink>
          {currentUser ? (
            <>
              <NavLink to="/live-map" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <span className="mobile-nav-icon">🗺️</span>
                <span>{t.liveMap || 'Live Map'}</span>
              </NavLink>
              <NavLink to="/report" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <span className="mobile-nav-icon">📝</span>
                <span>{t.reportFlood || 'Report'}</span>
              </NavLink>
              {userRole === 'authority' && (
                <NavLink to="/dashboard" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                  <span className="mobile-nav-icon">📊</span>
                  <span>{t.dashboard || 'Dashboard'}</span>
                </NavLink>
              )}
              <Link to="/" onClick={() => signOut(auth)} className="mobile-nav-item">
                <span className="mobile-nav-icon">🔓</span>
                <span>{t.logout || 'Logout'}</span>
              </Link>
            </>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <span className="mobile-nav-icon">👤</span>
                <span>{t.login || 'Login'}</span>
              </NavLink>
              <NavLink to="/signup" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <span className="mobile-nav-icon">📝</span>
                <span>{t.signup || 'Signup'}</span>
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

function LoginView({ t = translations.en }) {
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const role = getRoleForEmail(user.email);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          email: user.email,
          role: role,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (docErr) {
        console.warn("Login Firestore user role write warning:", docErr);
      }

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
        <h2>{t.welcomeBack || 'Welcome Back'}</h2>
        <p>{t.loginSubtitle || 'Log in to access your forecasting settings and telemetry database.'}</p>
        {error && (
          <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label" htmlFor="login_email">{t.emailAddressLabel || 'Email Address'}</label>
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
          <label className="form-label" htmlFor="login_password">{t.passwordLabel || 'Password'}</label>
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
          {loading ? (t.signingInBtn || 'Signing In...') : (t.signInBtn || 'Sign In')}
        </button>
      </form>

      <div className="auth-footer">
        {t.dontHaveAccount || "Don't have an account?"} <Link to="/signup">{t.signup || 'Sign Up'}</Link>
      </div>
    </div>
  );
}

// ==========================================
// SIGNUP VIEW (Firebase Register + Firestore user record)
// ==========================================

function SignupView({ t = translations.en }) {
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
      const role = getRoleForEmail(email);

      // Save user reference record in Firestore's 'users' collection with role
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        email: email,
        role: role,
        createdAt: serverTimestamp()
      }, { merge: true });

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
        <h2>{t.createAccountTitle || 'Create Account'}</h2>
        <p>{t.signupSubtitle || 'Register to participate in forecasting and flood sighting reports.'}</p>
        {error && (
          <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSignup}>
        <div className="form-group">
          <label className="form-label" htmlFor="signup_email">{t.emailAddressLabel || 'Email Address'}</label>
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
          <label className="form-label" htmlFor="signup_password">{t.passwordLabel || 'Password'}</label>
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
          <label className="form-label" htmlFor="signup_confirm_password">{t.confirmPasswordLabel || 'Confirm Password'}</label>
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
          {loading ? (t.creatingAccountBtn || 'Creating Account...') : (t.signUpBtn || 'Sign Up')}
        </button>
      </form>

      <div className="auth-footer">
        {t.alreadyHaveAccount || 'Already have an account?'} <Link to="/login">{t.login || 'Log In'}</Link>
      </div>
    </div>
  );
}

// ==========================================
// HOME VIEW (Introductory Landing Layout)
// ==========================================

function HomeView({ t = translations.en }) {
  return (
    <div className="home-layout">
      {/* Banner / Hero Section */}
      <section className="home-hero pulsing-glow">
        <h2 className="home-title">{t.homeHeroTitle || 'Predicting river pulses, protecting basin communities'}</h2>
        <p className="home-subtitle">
          {t.homeHeroSubtitle || 'Flood Pulse AI is a hydrology forecasting platform utilizing mock predictive neural engines to monitor river swelling patterns, upstream water discharges, and soil moisture levels. Assess risks and plan ahead.'}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/dashboard" className="btn btn-primary">
            {t.openAnalyticsDashboard || '🚀 Open Analytics Dashboard'}
          </Link>
          <Link to="/live-map" className="btn btn-secondary">
            {t.viewFloodMap || '🗺️ View Flood Map'}
          </Link>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section className="info-grid">
        <div className="info-card">
          <span className="card-icon">📡</span>
          <h3 className="card-title">{t.card1Title || 'Hydrological Monitoring'}</h3>
          <p className="card-desc">
            {t.card1Desc || 'Aggregates live sensor telemetry including real-time water levels, discharge volumes, precipitation depth, and land saturation levels.'}
          </p>
        </div>
        <div className="info-card">
          <span className="card-icon">🧠</span>
          <h3 className="card-title">{t.card2Title || 'AI Predictive Simulator'}</h3>
          <p className="card-desc">
            {t.card2Desc || 'Run custom models adjusting upstream release and humidity variables. Get risk calculations and inundation forecasts.'}
          </p>
        </div>
        <div className="info-card">
          <span className="card-icon">📣</span>
          <h3 className="card-title">{t.card3Title || 'Incident Crowdsourcing'}</h3>
          <p className="card-desc">
            {t.card3Desc || 'Enables regional emergency contacts and local citizens to report flood sightings to calibrate automated risk maps.'}
          </p>
        </div>
      </section>
    </div>
  );
}

// ==========================================
// REPORT FLOOD VIEW (Sightings Form Layout)
// ==========================================

function ReportFloodView({ currentUser, t = translations.en }) {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [allReports, setAllReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  const [formData, setFormData] = useState({
    location: "",
    severity: "",
    email: currentUser?.email || "",
    details: ""
  });

  useEffect(() => {
    if (currentUser?.email && !formData.email) {
      setFormData(prev => ({ ...prev, email: currentUser.email }));
    }
  }, [currentUser]);

  // Real-time listener for ALL reports from ALL users ordered by timestamp desc
  useEffect(() => {
    const reportsQuery = query(
      collection(db, 'citizen_reports'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
      const reportsData = snapshot.docs.map(docItem => ({
        id: docItem.id,
        ...docItem.data()
      }));
      setAllReports(reportsData);
      setReportsLoading(false);
    }, (err) => {
      console.warn("Error fetching all citizen reports:", err);
      setReportsLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
      const reportsRef = collection(db, 'citizen_reports');
      await addDoc(reportsRef, {
        location: formData.location,
        severity: formData.severity,
        email: currentUser?.email || formData.email || 'Anonymous',
        details: formData.details,
        photoUrl: photoUrl || null,
        timestamp: serverTimestamp()
      });

      setFormData({
        location: "",
        severity: "",
        email: currentUser?.email || "",
        details: ""
      });
      setSelectedFile(null);
      setSubmitted(true);
      setShowForm(false);
    } catch (err) {
      console.error("Firestore error logging incident: ", err);
      setError("Unable to submit report. Please verify connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-layout panel pulsing-glow">
      {/* Top Header Row with Page Title & Small '+' Button */}
      <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 6px' }}>{t.reportLocalIncident || 'Report Incident & Sightings Feed'}</h2>
          <p style={{ margin: 0 }}>{t.reportSubtitle || 'Live community feed of flood sightings and hydrological reports from all users.'}</p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setSubmitted(false);
          }}
          title={showForm ? 'Close Report Form' : 'Submit New Report'}
          style={{
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: '700',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {showForm ? '✕ Close' : '➕ New Report'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginBottom: '16px', fontWeight: '600' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Submission Confirmation Banner when submitted */}
      {submitted && !showForm && (
        <div style={{ background: 'rgba(0, 230, 118, 0.12)', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'center' }}>
          <span style={{ fontSize: '24px', display: 'block', marginBottom: '4px' }}>✅</span>
          <h4 style={{ color: '#00e676', margin: '0 0 4px' }}>{t.reportLogged || 'Report Successfully Published!'}</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Your sighting has been logged to the live community feed below.
          </p>
        </div>
      )}

      {/* Collapsible Form (Shown when '+' button is clicked) */}
      {showForm && (
        <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-muted)', borderRadius: '14px', padding: '24px', marginBottom: '32px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-bright)', fontSize: '18px' }}>
            📝 {t.submitIncidentSighting || 'Submit Incident Sighting'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="location">{t.incidentLocation || 'Incident Location / Area'}</label>
              <input 
                type="text" 
                id="location" 
                className="form-input" 
                placeholder={t.locationPlaceholder || 'e.g. Kulur River Bridge, Mangaluru'}
                value={formData.location}
                onChange={handleChange}
                required 
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="severity">{t.visualSeverity || 'Visual Water Level Severity'}</label>
              <select 
                id="severity" 
                className="form-select" 
                value={formData.severity}
                onChange={handleChange}
                required
                disabled={submitting}
              >
                <option value="">{t.chooseSeverity || 'Choose Severity Option...'}</option>
                <option value="normal">{t.normalBaseline || 'Normal Baseline (Safe)'}</option>
                <option value="elevated">{t.elevatedSeverity || 'Elevated (Flooded Banks)'}</option>
                <option value="severe">{t.severeSeverity || 'Severe (Inundation of Fields/Roadways)'}</option>
                <option value="critical">{t.criticalSeverity || 'Critical (Levee Overtopping/Evacuating)'}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">{t.reporterEmail || 'Reporter Contact Email'}</label>
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
              <label className="form-label" htmlFor="details">{t.observationsLabel || 'Observations & Details'}</label>
              <textarea 
                id="details" 
                className="form-textarea" 
                placeholder={t.observationsPlaceholder || 'Provide a brief description of river state, blockages, or structures affected...'}
                value={formData.details}
                onChange={handleChange}
                disabled={submitting}
              ></textarea>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="photo">{t.sightingDoc || 'Sighting Documentation (Photos / Video)'}</label>
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
                  <span className="upload-text">{t.clickOrDragUpload || 'Click or drag media files here to attach photo to incident log'}</span>
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
        </div>
      )}

      {/* Full List of ALL Reports from ALL Users */}
      <section style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-bright)' }}>
            📋 {t.allIncidentReports || 'Community Incident Feed'} ({allReports.length})
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {reportsLoading ? 'Syncing reports...' : 'Real-time updates'}
          </span>
        </div>

        {reportsLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading community report feed...
          </div>
        ) : allReports.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
            No incident reports submitted yet. Click <strong>➕ New Report</strong> above to be the first!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {allReports.map((report) => {
              const sevUpper = (report.severity || '').toUpperCase();
              return (
                <div 
                  key={report.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {/* Report Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="user-email-badge" style={{ fontSize: '12px' }}>
                        👤 {report.email || 'Anonymous Citizen'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`alert-indicator ${sevUpper}`} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}>
                        {report.severity || 'ELEVATED'}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        🕒 {getTimeAgo(report.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Location & Details */}
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--text-bright)' }}>
                      📍 {report.location || 'Incident Area'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                      {report.details || 'No additional details provided.'}
                    </p>
                  </div>

                  {/* Photo Attachment if Present */}
                  {report.photoUrl && (
                    <div style={{ marginTop: '6px' }}>
                      <img 
                        src={report.photoUrl} 
                        alt="Incident Sighting Document" 
                        style={{
                          maxWidth: '100%',
                          maxHeight: '260px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
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
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'car',
        useHints: false,
        options: {
          alternatives: true
        }
      }),
      routeWhileDragging: false,
      showAlternatives: true,
      altLineOptions: { styles: [{ opacity: 0 }] },
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
      if (!routes || routes.length === 0) return;

      // Evaluate hazard overlap scores for candidate routes (avoid High Risk, prefer Safe, use Medium Risk only if needed)
      const evaluated = routes.map((r, idx) => {
        let highRiskCount = 0;
        let mediumRiskCount = 0;
        const coords = r.coordinates || [];

        for (const coord of coords) {
          for (const zone of zones) {
            const statusStr = ((zone.status || zone.risk || '') + '').toUpperCase();
            const isHighRisk = statusStr.includes('CRITICAL') || statusStr.includes('HIGH');
            const isMediumRisk = statusStr.includes('WARNING') || statusStr.includes('MEDIUM');

            const rawZLat = zone.lat ?? zone.latitude;
            const rawZLng = zone.lng ?? zone.longitude;
            if (rawZLat !== undefined && rawZLng !== undefined && rawZLat !== null && rawZLng !== null) {
              const zLat = parseFloat(rawZLat);
              const zLng = parseFloat(rawZLng);
              if (!isNaN(zLat) && !isNaN(zLng)) {
                const dist = map.distance([coord.lat, coord.lng], [zLat, zLng]);
                const threshold = (parseFloat(zone.radius) || 1400) + 200;
                if (dist < threshold) {
                  if (isHighRisk) highRiskCount++;
                  else if (isMediumRisk) mediumRiskCount++;
                }
              }
            }
          }
        }
        return { index: idx, route: r, highRiskCount, mediumRiskCount };
      });

      const directRouteEval = evaluated.find(item => item.index === 0) || evaluated[0];
      const directHasHighRisk = directRouteEval.highRiskCount > 0;
      const directHasMediumRisk = directRouteEval.mediumRiskCount > 0;
      const directHasAnyRisk = directHasHighRisk || directHasMediumRisk;

      // Sort candidate routes: 1. Minimize High Risk, 2. Minimize Medium Risk, 3. Minimize total distance
      evaluated.sort((a, b) => {
        if (a.highRiskCount !== b.highRiskCount) return a.highRiskCount - b.highRiskCount;
        if (a.mediumRiskCount !== b.mediumRiskCount) return a.mediumRiskCount - b.mediumRiskCount;
        return a.route.summary.totalDistance - b.route.summary.totalDistance;
      });

      const selected = evaluated[0];
      const bestRoute = selected.route;
      const summary = bestRoute.summary;
      const coordinates = bestRoute.coordinates;

      setRouteCoords(coordinates.map(c => [c.lat, c.lng]));
      
      let hrs = Math.floor(summary.totalTime / 3600);
      let mins = Math.round((summary.totalTime % 3600) / 60);
      let timeStr = hrs > 0 ? `${hrs} hr ${mins} mins` : `${mins} mins`;

      const selectedHasHighRisk = selected.highRiskCount > 0;
      const selectedHasMediumRisk = selected.mediumRiskCount > 0;
      const selectedHasAnyRisk = selectedHasHighRisk || selectedHasMediumRisk;

      let warningMsg = '';
      let isUnsafe = false;

      if (!directHasAnyRisk) {
        // Direct route is already completely safe
        warningMsg = '✅ Safe Route: No active flood hazards along route.';
        isUnsafe = false;
      } else if (!selectedHasAnyRisk) {
        // Alternative route successfully avoided ALL risk zones
        warningMsg = '🛡️ Rerouted: Alternative route selected to avoid active risk zones.';
        isUnsafe = false;
      } else if (selected.highRiskCount < directRouteEval.highRiskCount) {
        // Rerouted to avoid High Risk (CRITICAL) areas, though passes through Medium Risk
        warningMsg = '⚠️ CAUTION: Rerouted through Medium Risk area (avoiding High Risk flood zones).';
        isUnsafe = false;
      } else {
        // No risk-free alternative exists within available OSRM routes
        warningMsg = '⚠️ WARNING: No safer alternative found — proceed with caution.';
        isUnsafe = true;
      }

      setRouteInfo({
        distance: (summary.totalDistance / 1000).toFixed(1) + ' km',
        time: timeStr,
        unsafe: isUnsafe,
        warningMsg: warningMsg
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

// Helper to calculate distance in kilometers between two lat/lng coordinates
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

function LiveMapView({ t = translations.en }) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);

  // User location coordinate tracker & Map Center tracker
  const [userLoc, setUserLoc] = useState([12.9716, 77.5946]);
  const [mapCenter, setMapCenter] = useState([12.9716, 77.5946]);
  const [hasUserLoc, setHasUserLoc] = useState(false);

  const [destInput, setDestInput] = useState('');
  const [startInput, setStartInput] = useState('');
  const [startCoords, setStartCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  const fetchUserLocation = () => {
    setIsLocating(true);
    
    const fallbackToIP = async (errorMsg) => {
      console.warn(`Geolocation failed (${errorMsg}). Falling back to IP-based location.`);
      try {
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipData = await ipRes.json();
        if (ipData.latitude && ipData.longitude) {
          const coords = [ipData.latitude, ipData.longitude];
          setUserLoc(coords);
          setMapCenter(coords);
          setHasUserLoc(true);
          setStartInput(`My Location (${ipData.city || 'IP'})`);
          setStartCoords(coords);
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
          const coords = [position.coords.latitude, position.coords.longitude];
          setUserLoc(coords);
          setMapCenter(coords);
          setHasUserLoc(true);
          setStartInput('My Location (GPS)');
          setStartCoords(coords);
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
    setRouteError('');

    try {
      let resolvedStart = startCoords || userLoc;
      
      // 1. Geocode Start Location with accept-language=en, countrycodes=in, and viewbox=74.7,13.0,75.0,12.7&bounded=1
      if (!startInput.startsWith('My Location') || !resolvedStart) {
        const startUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(startInput)}&format=json&accept-language=en&countrycodes=in&viewbox=74.7,13.0,75.0,12.7&bounded=1`;
        console.log(`🌐 [Nominatim Start Geocode Request URL]:`, startUrl);
        const startRes = await fetch(startUrl);
        let startData = await startRes.json();
        console.log("📦 [Nominatim Start Geocode Raw Response]:", startData);

        // Fallback for start location if bounded viewbox yields 0 results
        if (!startData || startData.length === 0) {
          const startFallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(startInput)}&format=json&accept-language=en&countrycodes=in`;
          console.log(`🌐 [Nominatim Start Fallback Request URL]:`, startFallbackUrl);
          const startResFb = await fetch(startFallbackUrl);
          startData = await startResFb.json();
          console.log("📦 [Nominatim Start Fallback Raw Response]:", startData);
        }

        if (startData && startData.length > 0) {
          resolvedStart = [parseFloat(startData[0].lat), parseFloat(startData[0].lon)];
          setStartCoords(resolvedStart);
        } else {
          console.log(`❌ [Validation Check Failed - Rejected]: Start location geocoding returned 0 results for query "${startInput}".`);
          setRouteError("Location not found — please enter a valid address");
          setDestinationCoords(null);
          setRouteInfo(null);
          setRouteCoords([]);
          setRouteLoading(false);
          return;
        }
      }

      // 2. Geocode Destination Location with accept-language=en, countrycodes=in, and viewbox=74.7,13.0,75.0,12.7&bounded=1
      const destUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destInput)}&format=json&accept-language=en&countrycodes=in&viewbox=74.7,13.0,75.0,12.7&bounded=1`;
      console.log(`🌐 [FINAL DESTINATION REQUEST URL RIGHT BEFORE FETCH]: ${destUrl}`);
      const res = await fetch(destUrl);
      let data = await res.json();

      console.log("📦 [Nominatim Destination Geocode Raw Response]:", data);

      // Fallback 1: If strict bounded viewbox returns 0 results, retry without bounded=1 (viewbox bias + countrycodes=in)
      if ((!data || data.length === 0)) {
        const fallbackUrl1 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destInput)}&format=json&accept-language=en&countrycodes=in&viewbox=74.7,13.0,75.0,12.7`;
        console.log(`🌐 [FINAL FALLBACK 1 REQUEST URL RIGHT BEFORE FETCH]: ${fallbackUrl1}`);
        const fallbackRes1 = await fetch(fallbackUrl1);
        data = await fallbackRes1.json();
        console.log("📦 [Nominatim Fallback 1 Raw Response]:", data);
      }

      // Fallback 2: If query still returns 0 results and has no comma, retry with ", India"
      if ((!data || data.length === 0) && !destInput.includes(',')) {
        const fallbackUrl2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destInput + ', India')}&format=json&accept-language=en&countrycodes=in`;
        console.log(`🌐 [FINAL FALLBACK 2 REQUEST URL RIGHT BEFORE FETCH]: ${fallbackUrl2}`);
        const fallbackRes2 = await fetch(fallbackUrl2);
        data = await fallbackRes2.json();
        console.log("📦 [Nominatim Fallback 2 Raw Response]:", data);
      }

      if (!data || data.length === 0) {
        console.log(`❌ [Validation Check Failed - Rejected]: Nominatim returned 0 results for query "${destInput}" after primary and fallback searches. Rejection cause: Empty results array.`);
        setRouteError("Location not found — please enter a valid address");
        setDestinationCoords(null);
        setRouteInfo(null);
        setRouteCoords([]);
        setRouteLoading(false);
        return;
      }

      const destLat = parseFloat(data[0].lat);
      const destLng = parseFloat(data[0].lon);

      if (isNaN(destLat) || isNaN(destLng)) {
        console.log(`❌ [Validation Check Failed - Rejected]: Geocoded destination coordinates for "${destInput}" parsed as NaN. Rejection cause: Invalid NaN coordinates.`, { rawLat: data[0]?.lat, rawLon: data[0]?.lon });
        setRouteError("Location not found — please enter a valid address");
        setDestinationCoords(null);
        setRouteInfo(null);
        setRouteCoords([]);
        setRouteLoading(false);
        return;
      }

      // 3. Distance Check: Destination must be within 100km of current/start location
      const baseLoc = resolvedStart || userLoc;
      if (baseLoc) {
        const distKm = calculateDistanceKm(baseLoc[0], baseLoc[1], destLat, destLng);
        console.log(`📏 [Distance Check] Geocoded location "${data[0].display_name}" (${destLat}, ${destLng}) is ${distKm.toFixed(2)} km away from start.`);
        if (distKm > 100) {
          console.log(`❌ [Validation Check Failed - Rejected]: Geocoded destination is ${distKm.toFixed(1)}km away from start. Rejection cause: Exceeds 100km distance limit.`);
          setRouteError("Location not found — please enter a valid address within 100km");
          setDestinationCoords(null);
          setRouteInfo(null);
          setRouteCoords([]);
          setRouteLoading(false);
          return;
        }
      }

      // Valid destination! Clear errors & update destination coordinates (DO NOT recreate flood zones)
      setRouteError('');
      setDestinationCoords([destLat, destLng]);
    } catch (err) {
      console.log(`❌ [Validation Check Failed - Rejected]: Geocoding request threw an exception for "${destInput}". Rejection cause: Network/Fetch Exception.`, err);
      setRouteError("Location not found — please enter a valid address");
      setDestinationCoords(null);
      setRouteInfo(null);
      setRouteCoords([]);
    } finally {
      setRouteLoading(false);
    }
  };

  // Request browser geolocation on mount
  useEffect(() => {
    fetchUserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

// Helper to generate a smooth, round organic polygon with 14 control points and cosine-interpolated 28 rounded vertices
function generateIrregularBlob(centerLat, centerLng, baseRadius = 0.0075, seed = 1) {
  const numControlPoints = 14;
  const pseudoRandom = (idx) => {
    const sinVal = Math.sin(seed * 78.233 + idx * 12.9898) * 43758.5453;
    return sinVal - Math.floor(sinVal);
  };

  // Generate control radii with subtle 90% to 110% variation
  const radii = [];
  for (let i = 0; i < numControlPoints; i++) {
    radii.push(baseRadius * (0.90 + pseudoRandom(i) * 0.20));
  }

  // Cosine smooth interpolation across 28 vertices for natural rounded contours
  const numVertices = 28;
  const positions = [];

  for (let i = 0; i < numVertices; i++) {
    const frac = (i / numVertices) * numControlPoints;
    const idx1 = Math.floor(frac) % numControlPoints;
    const idx2 = (idx1 + 1) % numControlPoints;
    const t = frac - Math.floor(frac);
    
    // Smooth cosine interpolation
    const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
    const r = radii[idx1] * (1 - smoothT) + radii[idx2] * smoothT;

    const angle = (i * 2 * Math.PI) / numVertices;
    const latOffset = r * Math.cos(angle);
    const lngOffset = (r * Math.sin(angle)) / Math.cos(centerLat * (Math.PI / 180));
    positions.push([centerLat + latOffset, centerLng + lngOffset]);
  }

  return positions;
}

  // Dynamically generate & anchor risk zone overlay polygons around the Current Location field (startCoords || userLoc)
  useEffect(() => {
    const currentStartCenter = startCoords || userLoc;
    if (!currentStartCenter || currentStartCenter.length < 2) return;
    const [cLat, cLng] = currentStartCenter;
    setLoading(true);

    const apiKey = "a770b95390e72d4ac82fab668028f53a";

    // 3 well-separated sector configurations firmly anchored around Current Location (startCoords || userLoc)
    const sampleConfigs = [
      { id: `curr_nw_${cLat.toFixed(3)}_${cLng.toFixed(3)}`, name: 'North River Basin', latOff: 0.014, lngOff: -0.014, defaultStatus: 'CRITICAL', defaultRisk: 'High Risk', seed: 101 },
      { id: `curr_east_${cLat.toFixed(3)}_${cLng.toFixed(3)}`, name: 'East Delta District', latOff: 0.011, lngOff: 0.016, defaultStatus: 'WARNING', defaultRisk: 'Medium Risk', seed: 202 },
      { id: `curr_south_${cLat.toFixed(3)}_${cLng.toFixed(3)}`, name: 'South Outflow Plain', latOff: -0.015, lngOff: -0.004, defaultStatus: 'NORMAL', defaultRisk: 'Safe', seed: 303 }
    ];

    const fetchCurrentLocationAnchoredZones = async () => {
      try {
        const newZones = await Promise.all(sampleConfigs.map(async (cfg) => {
          const lat = cLat + cfg.latOff;
          const lng = cLng + cfg.lngOff;
          
          let rain1h = 0;
          let desc = "Neighborhood hydrological risk zone.";
          let status = cfg.defaultStatus;
          let risk = cfg.defaultRisk;
          let zoneName = cfg.name;

          // Reverse geocode lat/lng using Nominatim to fetch real neighborhood/locality name
          try {
            const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`;
            console.log(`🌐 [Reverse Geocode Request] Fetching neighborhood for point (${lat.toFixed(4)}, ${lng.toFixed(4)}):`, revUrl);
            const revRes = await fetch(revUrl);
            if (revRes.ok) {
              const revData = await revRes.json();
              console.log("📦 [Reverse Geocode Raw Response]:", revData);
              const addr = revData.address || {};
              const localName = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || addr.village || addr.town || addr.city_district || addr.county || revData.name || (revData.display_name ? revData.display_name.split(',')[0] : null);
              if (localName && localName.trim().length > 0) {
                zoneName = `${localName.trim()} Zone`;
              }
            }
          } catch (revErr) {
            console.warn(`Reverse geocoding error for point (${lat}, ${lng}):`, revErr);
          }

          try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              rain1h = data.rain?.['1h'] || (data.rain?.['3h'] ? data.rain['3h'] / 3 : 0);
              desc = `${data.weather?.[0]?.description || 'Live weather'}. Temp: ${data.main?.temp || 'N/A'}°C, Humidity: ${data.main?.humidity || 'N/A'}%.`;

              if (rain1h > 20) {
                status = 'CRITICAL';
                risk = 'High Risk';
              } else if (rain1h > 10) {
                status = 'WARNING';
                risk = 'Medium Risk';
              }
            }
          } catch (err) {
            console.warn(`Weather fetch failed for ${zoneName}:`, err);
          }

          const polygonPoints = generateIrregularBlob(lat, lng, 0.0075, cfg.seed);

          return {
            id: cfg.id,
            name: zoneName,
            lat: lat,
            lng: lng,
            latitude: lat,
            longitude: lng,
            status: status,
            risk: risk,
            level: `${(rain1h * 0.15 + 2.5).toFixed(1)}m`,
            rainfall_mm: rain1h,
            desc: desc,
            polygonPoints: polygonPoints,
            radius: 1400
          };
        }));

        setZones(newZones);
        if (newZones.length > 0) {
          setSelectedZone(newZones[0]);
        }
      } catch (err) {
        console.error("Error generating Current Location anchored risk zones:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentLocationAnchoredZones();
  }, [startCoords, userLoc]);

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
    <div className={`map-view-grid ${isFullscreen ? 'fullscreen-map-mode' : ''}`}>
      {/* Map Interactive Canvas */}
      <section className="panel map-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="map-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="panel-title" style={{ margin: 0 }}>🗺️ {t.liveRiskOverview || 'Live Risk Overview'}</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.05)', padding: '3px 8px', borderRadius: '12px', border: '1px solid var(--border-muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: loading ? 'var(--color-warning)' : 'var(--color-success)', display: 'inline-block' }}></span>
              {loading ? (t.statusConnecting || 'Connecting...') : (t.statusConnected || 'Connected Live')}
            </span>
          </div>

          <button 
            className="fullscreen-toggle-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
            aria-label="Fullscreen Map"
          >
            {isFullscreen ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>

        {isFullscreen && (
          <button 
            onClick={() => setIsFullscreen(false)}
            className="floating-exit-fullscreen-btn"
            title="Exit Fullscreen"
          >
            ✕ Exit Fullscreen
          </button>
        )}

        <div className="map-canvas" style={{ flexGrow: 1, minHeight: '380px', position: 'relative', overflow: 'hidden' }}>
          {/* Leaflet React Map Container */}
          <MapContainer center={startCoords || userLoc} zoom={12} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <ChangeMapView center={startCoords || userLoc} />
            
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

            {/* Render Google Maps style flood overlay polygons */}
            {zones.map((zone) => {
              const rawLat = zone.lat ?? zone.latitude;
              const rawLng = zone.lng ?? zone.longitude;
              
              if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) return null;

              const lat = parseFloat(rawLat);
              const lng = parseFloat(rawLng);

              if (isNaN(lat) || isNaN(lng)) return null;

              const statusStr = ((zone.status || zone.risk || '') + '').toUpperCase();
              const riskStr = zone.risk || (statusStr.includes('CRITICAL') ? 'High Risk' : statusStr.includes('WARNING') ? 'Medium Risk' : 'Safe');

              const isHigh = statusStr.includes('CRITICAL') || statusStr.includes('HIGH');
              const isMedium = statusStr.includes('WARNING') || statusStr.includes('MEDIUM');

              // Solid, confident risk zone fill colors & clear stroke boundaries
              const fillColor = isHigh ? '#ef4444' : isMedium ? '#facc15' : '#22c55e';
              const strokeColor = isHigh ? '#dc2626' : isMedium ? '#d97706' : '#16a34a';

              return (
                <Polygon 
                  key={zone.id} 
                  positions={zone.polygonPoints || generateIrregularBlob(lat, lng, 0.0075, 1)} 
                  pathOptions={{
                    color: strokeColor,
                    fillColor: fillColor,
                    fillOpacity: 0.65,
                    weight: 3,
                    className: 'risk-zone-polygon'
                  }}
                  eventHandlers={{
                    click: () => setSelectedZone(zone)
                  }}
                >
                  <Tooltip permanent direction="center" className="zone-map-label">
                    <div style={{ textAlign: 'center', lineHeight: '1.3' }}>
                      <div style={{ fontWeight: '800', fontSize: '12px', color: '#ffffff', whiteSpace: 'nowrap', marginBottom: '3px' }}>
                        {zone.name || 'Flood Zone'}
                      </div>
                      <div style={{ 
                        fontSize: '10px', 
                        fontWeight: '800',
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        letterSpacing: '0.3px',
                        background: isHigh ? 'rgba(239, 68, 68, 0.28)' : isMedium ? 'rgba(250, 204, 21, 0.28)' : 'rgba(34, 197, 94, 0.28)',
                        border: `1px solid ${isHigh ? '#ef4444' : isMedium ? '#facc15' : '#22c55e'}`,
                        color: isHigh ? '#fca5a5' : isMedium ? '#fef08a' : '#86efac'
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
                        Status: <strong style={{ color: strokeColor }}>{riskStr}</strong>
                      </div>
                    </div>
                  </Popup>
                </Polygon>
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
          <h3 className="panel-title" style={{ marginBottom: '16px' }}>🗺️ {t.findSafeRoute || 'Find Safe Route'}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.currentLocation || 'Current Location'}</label>
                <button onClick={handleUseMyLocation} disabled={isLocating} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '11px', cursor: isLocating ? 'not-allowed' : 'pointer', opacity: isLocating ? 0.5 : 1 }}>
                  {isLocating ? '⏳ Locating...' : (t.useGps || 'Use GPS')}
                </button>
              </div>
              <input 
                type="text" 
                placeholder={t.enterStartLocation || "Enter start location..."}
                value={startInput}
                onChange={(e) => {
                  setStartInput(e.target.value);
                  if (e.target.value !== 'My Location (GPS)') setStartCoords(null);
                }}
                style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-muted)', color: 'white', borderRadius: '4px', boxSizing: 'border-box' }} 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{t.destination || 'Destination'}</label>
              <input 
                type="text" 
                placeholder={t.enterDestinationAddress || "Enter destination address..."}
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
              {routeLoading ? (t.searchRouteLoading || 'Calculating...') : (t.searchRouteBtn || 'Find Safe Route')}
            </button>
            
            {routeError && (
              <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '4px', background: 'rgba(255, 62, 62, 0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: '13px', fontWeight: 'bold' }}>
                ⚠️ {routeError}
              </div>
            )}

            {routeInfo && !routeError && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '4px',
                background: routeInfo.unsafe
                  ? 'rgba(239, 68, 68, 0.1)'
                  : routeInfo.warningMsg?.includes('CAUTION')
                  ? 'rgba(234, 179, 8, 0.1)'
                  : 'rgba(34, 197, 94, 0.1)',
                border: `1px solid ${
                  routeInfo.unsafe
                    ? '#ef4444'
                    : routeInfo.warningMsg?.includes('CAUTION')
                    ? '#eab308'
                    : '#22c55e'
                }`
              }}>
                <p style={{
                  margin: '0 0 8px',
                  color: routeInfo.unsafe
                    ? '#ef4444'
                    : routeInfo.warningMsg?.includes('CAUTION')
                    ? '#eab308'
                    : '#22c55e',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}>
                  {routeInfo.warningMsg || (routeInfo.unsafe ? '⚠️ WARNING: No safer alternative found — proceed with caution.' : '✅ Safe Route: No active flood hazards detected.')}
                </p>
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

function DashboardView({ backendHealthy, userRole, t = translations.en }) {
  // Theme switcher state (Dark Space default, Light Mode, Ocean Blue)
  const [dashboardTheme, setDashboardTheme] = useState(() => localStorage.getItem('dashboardTheme') || 'dark');

  // Real-time user management state for authority users
  const [usersList, setUsersList] = useState([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState(null);
  const [userMgmtLoading, setUserMgmtLoading] = useState(true);

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

  // Real-time listener for user management & reports (Authority Role Only)
  useEffect(() => {
    if (userRole !== 'authority') return;

    let usersMap = new Map();
    let reportsData = [];

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      snapshot.docs.forEach(d => {
        const u = d.data();
        if (u.email) {
          usersMap.set(u.email.toLowerCase(), {
            uid: d.id,
            email: u.email,
            role: u.role || getRoleForEmail(u.email),
            createdAt: u.createdAt
          });
        }
      });
      combineUsersAndReports();
    }, (err) => console.warn("Firestore users listener warn:", err));

    const unsubReports = onSnapshot(collection(db, 'citizen_reports'), (snapshot) => {
      reportsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      reportsData.forEach(r => {
        if (r.email) {
          const clean = r.email.trim().toLowerCase();
          if (!usersMap.has(clean)) {
            usersMap.set(clean, {
              uid: `legacy_${clean}`,
              email: r.email,
              role: getRoleForEmail(r.email),
              createdAt: r.timestamp
            });
          }
        }
      });

      combineUsersAndReports();
    }, (err) => console.warn("Firestore reports listener warn:", err));

    const combineUsersAndReports = () => {
      const combined = Array.from(usersMap.values()).map(u => {
        const uReports = reportsData.filter(r => (r.email || '').toLowerCase() === u.email.toLowerCase());
        uReports.sort((a, b) => {
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tB - tA;
        });
        return {
          ...u,
          reportCount: uReports.length,
          reports: uReports
        };
      });

      combined.sort((a, b) => b.reportCount - a.reportCount || a.email.localeCompare(b.email));
      setUsersList(combined);
      setUserMgmtLoading(false);
    };

    return () => {
      unsubUsers();
      unsubReports();
    };
  }, [userRole]);

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
    <div className={`dashboard-container dashboard-theme-${dashboardTheme}`} style={{ transition: 'all 0.3s ease' }}>
      {/* Theme Switcher Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 'bold', opacity: 0.85 }}>{t.dashboardThemeLabel || '🎨 Dashboard Theme:'}</span>
        <select 
          value={dashboardTheme} 
          onChange={(e) => {
            const selected = e.target.value;
            setDashboardTheme(selected);
            localStorage.setItem('dashboardTheme', selected);
          }}
          className="theme-switcher-dropdown"
          title="Select Dashboard Theme"
          aria-label="Select Dashboard Theme"
        >
          <option value="dark">{t.themeDark || '🌙 Dark Space (Default)'}</option>
          <option value="light">{t.themeLight || '☀️ Light Mode'}</option>
          <option value="ocean">{t.themeOcean || '🌊 Ocean Blue'}</option>
        </select>
      </div>

      <main className="dashboard-grid">
        {/* Left Side: Sensor Telemetry Widget */}
        <section className="panel pulsing-glow">
          <div className="panel-header">
            <h2 className="panel-title">{t.realTimeHydrology || '📡 Real-Time Hydrology Telemetry'}</h2>
            <button 
              className="btn btn-secondary" 
              onClick={fetchTelemetry}
              disabled={loadingTelemetry}
            >
              {loadingTelemetry ? (t.refreshingSensors || 'Refreshing Sensors...') : (t.pollSensors || '🔄 Poll Sensors')}
            </button>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
            {t.telemetryReadingsFrom || 'Telemetry readings from'} <strong>{telemetry.station}</strong>.
          </p>

          {/* Telemetry Gauge Cards */}
          <div className="telemetry-grid">
            <div className="telemetry-card">
              <div className="card-label">{t.waterLevel || 'Water Level'}</div>
              <div className="card-value">
                {telemetry.water_level_m} <span className="card-unit">m</span>
              </div>
            </div>

            <div className="telemetry-card">
              <div className="card-label">{t.riverDischarge || 'River Discharge'}</div>
              <div className="card-value">
                {telemetry.flow_rate_m3s} <span className="card-unit">m³/s</span>
              </div>
            </div>

            <div className="telemetry-card" style={{ position: 'relative' }}>
              <div className="card-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t.precipitationWeather || 'Precipitation / Weather'}</span>
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
                </div>
              )}
            </div>

            <div className="telemetry-card">
              <div className="card-label">{t.soilMoisture || 'Soil Moisture'}</div>
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
              <strong>{t.systemStatus || 'System Status:'}</strong> {telemetry.alert_desc}
            </div>
          </div>
        </section>

        {/* Right Side: AI Flood Risk Simulator */}
        <section className="panel">
        <h2 className="panel-title" style={{ marginBottom: '8px' }}>{t.aiPredictionSimulator || '🧠 AI Prediction Simulator'}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
          {t.simulatorSubtitle || 'Simulate flood risk by invoking the AI predictive models.'}
        </p>

        {/* Form Controls */}
        <form onSubmit={runPredictionSimulation}>
          <div className="form-group">
            <label className="form-label" htmlFor="sim_zone_name">{t.targetZoneName || 'Target Zone Name'}</label>
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
              <span>{t.rainfallLevel || 'Rainfall Level'}</span>
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
              <span>{t.waterLevelBaseline || 'Water Level Baseline'}</span>
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
            {runningSim ? (t.runningPredictionBtn || 'Running AI Model...') : (t.runPredictionBtn || '🧠 Run Prediction')}
          </button>
        </form>

        {/* Prediction Output Results */}
        {hasPredicted && (
          <div className="prediction-output-card" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t.predictionResult || 'Prediction Result'}
              </span>
              {firestoreSaved && (
                <span style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '600' }}>
                  {t.savedToFirestore || '✓ Saved to Firestore'}
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {t.forecastFor || 'Forecast for'} <strong>{simOutput.zone_name}</strong>
              </div>
              <span className={`alert-indicator ${simOutput.risk}`} style={{ fontSize: '18px', padding: '10px 24px', borderRadius: '8px' }}>
                {simOutput.risk}
              </span>
            </div>

            <div className="prediction-stats" style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
              <div className="stat-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label" style={{ margin: 0 }}>{t.modelConfidence || 'Model Confidence'}</span>
                <span className="stat-val" style={{ color: 'var(--color-primary)', fontWeight: '700' }}>{simOutput.confidence}%</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* User Management Panel (Authority Role Only) */}
      {userRole === 'authority' && (
        <section className="panel" style={{ marginTop: '24px', gridColumn: '1 / -1' }}>
          <div className="panel-header" style={{ marginBottom: '12px' }}>
            <h2 className="panel-title">👥 User Management & Sighting Audit</h2>
            <span className="user-email-badge" style={{ fontSize: '11px' }}>
              Authority Portal
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
            List of registered users and submitted report counts. Click a user to view their submitted incident reports inline.
          </p>

          {userMgmtLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
              Loading registered users and reports...
            </div>
          ) : usersList.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
              No users found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {usersList.map(user => {
                const isSelected = selectedUserEmail === user.email;
                return (
                  <div 
                    key={user.email} 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.02)', 
                      border: isSelected ? '1px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* User Row Header */}
                    <div 
                      onClick={() => setSelectedUserEmail(isSelected ? null : user.email)}
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(0, 176, 255, 0.06)' : 'transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>👤</span>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-bright)' }}>
                            {user.email}
                          </div>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '700', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            textTransform: 'uppercase',
                            background: user.role === 'authority' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                            color: user.role === 'authority' ? '#00e676' : 'var(--text-muted)'
                          }}>
                            {user.role === 'authority' ? '🏛️ Authority' : 'Citizen'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: user.reportCount > 0 ? 'rgba(0, 176, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: user.reportCount > 0 ? 'var(--color-primary)' : 'var(--text-muted)',
                          border: `1px solid ${user.reportCount > 0 ? 'rgba(0, 176, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                        }}>
                          📋 {user.reportCount} {user.reportCount === 1 ? 'Report' : 'Reports'}
                        </span>
                        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                          {isSelected ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {/* Inline Expanded User Detail View */}
                    {isSelected && (
                      <div style={{ padding: '16px 18px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(0, 0, 0, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-bright)' }}>
                            Reports Submitted by <span style={{ color: 'var(--color-primary)' }}>{user.email}</span>
                          </h4>
                          <button 
                            className="btn btn-secondary" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUserEmail(null);
                            }}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            Close Details
                          </button>
                        </div>

                        {user.reports.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', padding: '12px 0' }}>
                            This user has not submitted any incident reports yet.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                            {user.reports.map((rep, rIdx) => {
                              const sevUpper = (rep.severity || '').toUpperCase();
                              return (
                                <div 
                                  key={rep.id || rIdx} 
                                  style={{
                                    background: 'rgba(20, 24, 33, 0.8)',
                                    border: '1px solid var(--border-muted)',
                                    borderRadius: '12px',
                                    padding: '14px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-bright)' }}>
                                      📍 {rep.location || 'Unknown Location'}
                                    </span>
                                    <span className={`alert-indicator ${sevUpper}`} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>
                                      {rep.severity || 'ELEVATED'}
                                    </span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                                    {rep.details || 'No additional details provided.'}
                                  </p>
                                  {rep.photoUrl && (
                                    <div style={{ marginTop: '4px' }}>
                                      <img 
                                        src={rep.photoUrl} 
                                        alt="User Incident Sighting" 
                                        style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} 
                                      />
                                    </div>
                                  )}
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    🕒 {getTimeAgo(rep.timestamp)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
    </div>
  );
}

export default App;
