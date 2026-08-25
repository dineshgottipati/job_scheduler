import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@acme.com');
  const [password, setPassword] = useState('password123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Glassmorphism ambient background glow */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] bg-sky-500/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/15 rounded-full blur-[150px] pointer-events-none" />

      <div className="bg-slate-900/40 border border-white/10 backdrop-blur-xl rounded-2xl w-full max-w-md p-8 shadow-2xl shadow-black/50 space-y-6 z-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/25 border border-white/20 mx-auto text-xl">
            JS
          </div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-sky-200 to-indigo-200 tracking-tight">
            Welcome Back
          </h2>
          <p className="text-xs text-slate-400">Sign in to your Glassmorphism job scheduler dashboard</p>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-500/30 backdrop-blur-md text-rose-300 p-3 rounded-xl text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl pl-9 pr-4 py-2.5 text-slate-200 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl pl-9 pr-4 py-2.5 text-slate-200 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 border border-white/20 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/20 backdrop-blur-md transition-all text-xs"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-sky-400 font-medium hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};
