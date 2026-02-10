import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Lock, Mail, User, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

function Setup() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [isChecking, setIsChecking] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check setup status on mount
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const res = await fetch('/api/setup/status');
        const data = await res.json();
        
        if (data.hasMaster) {
          // Setup already complete, redirect to login
          navigate('/login');
          return;
        }
        
        setSetupNeeded(true);
        // Apply purple accent for the setup page
        document.documentElement.setAttribute('data-accent', 'purple');
      } catch (err) {
        console.error('Failed to check setup status:', err);
        // If API fails, assume setup is needed
        setSetupNeeded(true);
        document.documentElement.setAttribute('data-accent', 'purple');
      } finally {
        setIsChecking(false);
      }
    };

    checkSetupStatus();

    // Cleanup: reset to default accent on unmount
    return () => {
      document.documentElement.setAttribute('data-accent', 'amber');
    };
  }, [navigate]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setErrors({});

    try {
      const res = await fetch('/api/setup/create-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create master account');
      }

      // Show success state
      setSuccess(true);
      
      // Wait for animation then login and redirect
      setTimeout(() => {
        login(data.token, data.user);
        navigate('/chat');
      }, 1500);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950 bg-mesh">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-dark-400">Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (!setupNeeded) {
    return null; // Will redirect
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950 bg-mesh p-4">
        <div className="max-w-md w-full text-center">
          <div className="glass-card rounded-2xl p-12 scale-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/20 mb-6">
              <CheckCircle className="w-10 h-10 text-purple-400" />
            </div>
            <h2 className="text-3xl font-bold text-purple-400 mb-3">Setup Complete!</h2>
            <p className="text-dark-300 mb-2">Your master administrator account has been created.</p>
            <p className="text-dark-500 text-sm">Redirecting to your dashboard...</p>
            <div className="mt-6 flex justify-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 bg-mesh p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500 mb-4 shadow-lg shadow-purple-500/20">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-purple-400 mb-2 tracking-tight">
            Welcome to Budi Chat
          </h1>
          <p className="text-dark-400">Create your master administrator account</p>
        </div>

        {/* Form Card */}
        <div className="glass-card rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                {errors.submit}
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl glass-input outline-none text-dark-100 text-sm transition-all duration-200 ${
                    errors.name ? 'border-red-500/50 focus:border-red-500/50' : 'focus:border-purple-500/40'
                  }`}
                  placeholder="John Doe"
                  disabled={loading}
                />
              </div>
              {errors.name && (
                <p className="mt-1.5 text-xs text-red-400">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl glass-input outline-none text-dark-100 text-sm transition-all duration-200 ${
                    errors.email ? 'border-red-500/50 focus:border-red-500/50' : 'focus:border-purple-500/40'
                  }`}
                  placeholder="admin@example.com"
                  disabled={loading}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl glass-input outline-none text-dark-100 text-sm transition-all duration-200 ${
                    errors.password ? 'border-red-500/50 focus:border-red-500/50' : 'focus:border-purple-500/40'
                  }`}
                  placeholder="Create a secure password"
                  disabled={loading}
                />
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl glass-input outline-none text-dark-100 text-sm transition-all duration-200 ${
                    errors.confirmPassword ? 'border-red-500/50 focus:border-red-500/50' : 'focus:border-purple-500/40'
                  }`}
                  placeholder="Confirm your password"
                  disabled={loading}
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-400">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-400 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Creating Master Account...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Master Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-dark-500">
          <p className="flex items-center justify-center gap-2">
            <Crown className="w-3.5 h-3.5 text-purple-500/60" />
            This account will have full administrative privileges
          </p>
        </div>
      </div>
    </div>
  );
}

export default Setup;
