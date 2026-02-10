import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Setup from './pages/Setup';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Memories from './pages/Memories';
import Personas from './pages/Personas';
import SharedChat from './pages/SharedChat';
import { AuthContext } from './contexts/AuthContext';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(null);

  useEffect(() => {
    // Check if setup is needed first
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        setNeedsSetup(!data.hasMaster);
        
        if (data.hasMaster) {
          // Only check for existing session if setup is complete
          const token = localStorage.getItem('token');
          if (token) {
            return fetch('/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
              .then(res => res.json())
              .then(data => {
                if (data.id) {
                  setUser(data);
                  // Apply user's accent color and cache it
                  if (data.accent_color) {
                    document.documentElement.setAttribute('data-accent', data.accent_color);
                    localStorage.setItem('budi_accent_color_v2', data.accent_color);
                  }
                } else {
                  localStorage.removeItem('token');
                }
              })
              .catch(() => {
                localStorage.removeItem('token');
              });
          }
        }
      })
      .catch(() => {
        // If setup status fails, assume setup is needed
        setNeedsSetup(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
    // Mark setup as complete since a user is now logged in
    setNeedsSetup(false);
    // Apply user's accent color on login and cache it
    if (userData.accent_color) {
      document.documentElement.setAttribute('data-accent', userData.accent_color);
      localStorage.setItem('budi_accent_color_v2', userData.accent_color);
    }
  };

  const isMaster = () => {
    return user?.user_type === 'master' || user?.is_master === true;
  };

  const isAdmin = () => {
    return user?.user_type === 'master' || user?.user_type === 'admin' || user?.is_admin === true;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('budi_accent_color_v2');
    setUser(null);
    // Reset to default accent color
    document.documentElement.setAttribute('data-accent', 'amber');
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-dark-950 bg-mesh">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
          <p className="mt-4 text-dark-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If setup is needed, force redirect to setup page (except for setup route itself)
  if (needsSetup) {
    return (
      <AuthContext.Provider value={{ user, setUser, login, logout, isMaster, isAdmin }}>
        <Router>
          <Routes>
            <Route path="/setup" element={<Setup />} />
            <Route path="*" element={<Navigate to="/setup" />} />
          </Routes>
        </Router>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, isMaster, isAdmin }}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/share/:token" element={<SharedChat />} />

           {/* Setup route - redirect to login if setup complete */}
          <Route path="/setup" element={<Navigate to="/login" />} />

          {/* Auth routes */}
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />

          {/* Protected routes */}
          <Route path="/" element={user ? <Chat /> : <Navigate to="/login" />} />
          <Route path="/chat" element={user ? <Chat /> : <Navigate to="/login" />} />
          <Route path="/admin" element={isAdmin() ? <Admin /> : <Navigate to="/" />} />
          <Route path="/settings" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/memories" element={user ? <Memories /> : <Navigate to="/login" />} />
          <Route path="/personas" element={user ? <Personas /> : <Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
