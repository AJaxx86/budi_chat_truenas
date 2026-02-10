import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Lock, Mail, User, ArrowRight, AlertCircle } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const { login } = useContext(AuthContext);

  useEffect(() => {
    // Check if registration is enabled
    const checkRegistrationStatus = async () => {
      try {
        const res = await fetch('/api/setup/registration-status');
        if (res.ok) {
          const data = await res.json();
          setRegistrationEnabled(data.enabled);
        }
      } catch (error) {
        console.error('Failed to check registration status:', error);
      } finally {
        setCheckingRegistration(false);
      }
    };

    checkRegistrationStatus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingRegistration) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-dark-950 bg-mesh p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-accent border-t-transparent"></div>
          <p className="mt-4 text-dark-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-dark-950 bg-mesh p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-accent mb-2 tracking-tight">AI Chat Hub</h1>
          <p className="text-dark-400">
            {registrationEnabled ? 'Create your account to get started.' : 'Registration is currently closed.'}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          {!registrationEnabled ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-dark-100 mb-2">Registration Disabled</h2>
              <p className="text-dark-400 mb-6">
                New user registrations are currently disabled. Please contact an administrator if you need access.
              </p>
              <Link 
                to="/login" 
                className="inline-flex items-center gap-2 text-accent hover:text-accent-light font-medium transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                Go to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl glass-input outline-none text-dark-100 text-sm"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl glass-input outline-none text-dark-100 text-sm"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl glass-input outline-none text-dark-100 text-sm"
                    placeholder="Create a password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {registrationEnabled && (
            <div className="mt-6 text-center">
              <p className="text-sm text-dark-400">
                Already have an account?{' '}
                <Link to="/login" className="text-accent hover:text-accent-light font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-dark-500">
          <p>Multi-user AI chat with memories, tools & agent mode</p>
        </div>
      </div>
    </div>
  );
}

export default Register;
