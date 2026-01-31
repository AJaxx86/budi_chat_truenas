import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Memories from './pages/Memories';
import SharedChat from './pages/SharedChat';
import { AuthContext } from './contexts/AuthContext';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clean up legacy localStorage accent color (now stored per-user in database)
    localStorage.removeItem('budi_accent_color');

    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.id) {
            setUser(data);
            // Apply user's accent color
            if (data.accent_color) {
              document.documentElement.setAttribute('data-accent', data.accent_color);
            }
          } else {
            localStorage.removeItem('token');
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
    // Apply user's accent color on login
    if (userData.accent_color) {
      document.documentElement.setAttribute('data-accent', userData.accent_color);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950 bg-mesh">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
          <p className="mt-4 text-dark-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/share/:token" element={<SharedChat />} />

          {/* Auth routes */}
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />

          {/* Protected routes */}
          <Route path="/" element={user ? <Chat /> : <Navigate to="/login" />} />
          <Route path="/admin" element={user?.is_admin ? <Admin /> : <Navigate to="/" />} />
          <Route path="/settings" element={user ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/memories" element={user ? <Memories /> : <Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
