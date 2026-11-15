import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import Logo from '../components/Logo.jsx';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return toast.error('Minimum 8 characters');
    if (password !== confirm) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/auth/password/reset', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md card p-6"
      >
        <div className="flex justify-center mb-6"><Logo /></div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 grid place-items-center ring-4 ring-emerald-100">
              <CheckCircle2 className="text-emerald-600" size={28} />
            </div>
            <p className="text-base font-bold text-slate-800">Password updated</p>
            <p className="text-sm text-slate-500">Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto h-14 w-14 rounded-full bg-sky-50 grid place-items-center ring-4 ring-sky-100 mb-3">
                <KeyRound className="text-sky-600" size={26} />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900">Set a new password</h1>
              <p className="text-sm text-slate-500 mt-1">Choose a strong password for your account.</p>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label">New password</label>
                <div className="relative">
                  <input
                    className="input pr-11"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
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
              <div>
                <label className="label">Confirm password</label>
                <input
                  className="input"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
                {confirm && password !== confirm && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> Passwords do not match
                  </p>
                )}
              </div>
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <><KeyRound size={16} /> Update password</>
                )}
              </button>
            </form>

            <button
              onClick={() => navigate('/login')}
              className="mt-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft size={12} /> Back to sign in
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;