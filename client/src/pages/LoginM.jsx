import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-sky-500 via-indigo-500 to-indigo-600 p-12 text-white relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 -left-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" className="h-12 w-12 rounded-xl ring-1 ring-white/30" alt="logo" />
            <div>
              <div className="font-extrabold tracking-tight text-xl">Cynert Optical</div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/70">Records Management System</div>
            </div>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-3xl font-extrabold leading-tight mb-3">
            Manage optical orders<br/>with clarity and speed.
          </h2>
          <p className="text-white/80 max-w-md text-sm leading-relaxed">
            A modern, secure system for tracking patient records, lens orders, and delivery status - all in one place.
          </p>
        </div>
        <div className="relative text-xs text-white/60">
          © {new Date().getFullYear()} Cynert Optical. All rights reserved.
        </div>
      </motion.div>

      <div className="flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden mb-6 flex justify-center"><Logo /></div>
          <h1 className="text-2xl font-extrabold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">Sign in to your account to continue.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="Enter Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-11"
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><LogIn size={16} /> Sign In</>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;