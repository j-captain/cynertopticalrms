import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LogIn, Eye, EyeOff, Mail, KeyRound, ShieldAlert, ShieldCheck,
  CheckCircle2, Clock, UserX, UserCheck, ArrowRight, Headset,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Logo from '../components/Logo.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../lib/api.js';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [actStage, setActStage] = useState(null);
  const [actEmail, setActEmail] = useState('');
  const [actCode, setActCode] = useState('');
  const [actWorking, setActWorking] = useState(false);
  const [actMeta, setActMeta] = useState(null);

  const [rstStage, setRstStage] = useState(null);
  const [rstEmail, setRstEmail] = useState('');
  const [rstWorking, setRstWorking] = useState(false);
  const [rstMeta, setRstMeta] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      if (err.response?.data?.code === 'ACCOUNT_INACTIVE') {
        setInactiveOpen(true);
        return;
      }
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const openActivate = () => {
    setActEmail(email);
    setActCode('');
    setActMeta(null);
    setActStage('email');
  };

  const closeActivate = () => {
    if (actWorking) return;
    setActStage(null);
    setActCode('');
  };

  const submitActivationCode = async () => {
    const code = actCode.trim();
    if (!code) return toast.error('Enter the activation code');
    if (code.length !== 8) return toast.error('Activation code must be 8 characters');
    setActWorking(true);
    try {
      await api.post('/auth/activate', { code });
      setActStage(null);
      setActCode('');
      setActEmail('');
      toast.success('Account activated. You can now sign in.');
    } catch (err) {
      const d = err.response?.data;
      if (d?.code === 'ACCOUNT_ALREADY_ACTIVE') {
        setActStage(null);
        setActCode('');
        toast.success('Account is already active. Please sign in.');
      } else {
        toast.error(d?.message || 'Activation failed');
      }
    } finally {
      setActWorking(false);
    }
  };

  const resendActivation = async () => {
    if (!actEmail || !/^\S+@\S+\.\S+$/.test(actEmail)) {
      return toast.error('Enter a valid email address');
    }
    setActWorking(true);
    try {
      const r = await api.post('/auth/activate/resend', { email: actEmail });
      setActMeta({ remaining: r.data.remaining, nextAllowedAt: r.data.nextAllowedAt });
      setActStage('sent');
    } catch (err) {
      const d = err.response?.data;
      if (d?.code === 'ACCOUNT_NOT_FOUND') setActStage('notFound');
      else if (d?.code === 'ACCOUNT_ALREADY_ACTIVE') setActStage('alreadyActive');
      else if (err.response?.status === 429 && d?.code === 'ACTIVATION_RESEND_LIMIT') {
        setActMeta({ retryAfter: d.retryAfter });
        setActStage('throttled');
      } else {
        toast.error(d?.message || 'Could not send activation email');
      }
    } finally {
      setActWorking(false);
    }
  };

  const openReset = () => {
    setRstEmail(email);
    setRstMeta(null);
    setRstStage('email');
  };

  const closeReset = () => {
    if (rstWorking) return;
    setRstStage(null);
  };

  const requestReset = async () => {
    if (!rstEmail || !/^\S+@\S+\.\S+$/.test(rstEmail)) {
      return toast.error('Enter a valid email address');
    }
    setRstWorking(true);
    try {
      const r = await api.post('/auth/password/request-reset', { email: rstEmail });
      setRstMeta({ remaining: r.data.remaining });
      setRstStage('sent');
    } catch (err) {
      const d = err.response?.data;
      if (d?.code === 'ACCOUNT_INACTIVE') setRstStage('inactive');
      else if (d?.code === 'RESET_TOO_EARLY') {
        setRstMeta({ retryAfter: d.retryAfter });
        setRstStage('tooEarly');
      } else if (d?.code === 'RESET_LIMIT') {
        setRstMeta({ retryAfter: d.retryAfter });
        setRstStage('throttled');
      } else {
        toast.error(d?.message || 'Could not request password reset');
      }
    } finally {
      setRstWorking(false);
    }
  };

  const formatRetry = (seconds) => {
    if (!seconds || seconds < 0) return 'shortly';
    if (seconds < 60) return `in ${seconds}s`;
    if (seconds < 3600) return `in ${Math.ceil(seconds / 60)} min`;
    return `in ${Math.ceil(seconds / 3600)} h`;
  };

  const fieldVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.15 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
    }),
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      {/* ─────────── LEFT: Branding ─────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-sky-500 via-indigo-500 to-indigo-600 p-12 text-white relative overflow-hidden"
      >
        <motion.div
          animate={{ y: [0, -20, 0], x: [0, 12, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 24, 0], x: [0, -14, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />
        <motion.div
          animate={{ y: [0, -16, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 right-1/4 h-48 w-48 rounded-full bg-white/5 blur-2xl"
        />

        {/* Top: logo left, illustration centered below */}
        <div className="relative z-10 space-y-4">
          {/* Logo card - LEFT-ALIGNED exactly as before */}
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-3 shadow-2xl">
            <div className="relative">
              <div className="absolute inset-0 bg-sky-400/40 blur-lg rounded-xl" />
              <img
                src="/logo.svg"
                className="relative h-12 w-12 rounded-xl ring-1 ring-white/30"
                alt="logo"
              />
            </div>
            <div>
              <div className="font-extrabold tracking-tight text-xl">Cynert Optical</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/70">
                Records Management System
              </div>
            </div>
          </div>

          {/* Lenses - CENTERED below the logo card */}
          <div className="flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative inline-block"
            >
              <div className="absolute inset-0 -m-3 rounded-3xl bg-white/5 blur-2xl" />
              <svg
                viewBox="0 0 240 100"
                width="110"
                height="46"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Optical set illustration"
                className="relative drop-shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
              >
                <defs>
                  <linearGradient id="lensGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
                  </linearGradient>
                  <linearGradient id="frameGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                <rect x="20" y="24" width="82" height="56" rx="22" ry="22"
                  fill="url(#lensGrad)" stroke="url(#frameGrad)" strokeWidth="3" />
                <path d="M32 40 Q40 34 52 36" stroke="#ffffff" strokeWidth="2"
                  strokeLinecap="round" fill="none" opacity="0.55" />
                <rect x="138" y="24" width="82" height="56" rx="22" ry="22"
                  fill="url(#lensGrad)" stroke="url(#frameGrad)" strokeWidth="3" />
                <path d="M150 40 Q158 34 170 36" stroke="#ffffff" strokeWidth="2"
                  strokeLinecap="round" fill="none" opacity="0.55" />
                <path d="M102 46 Q120 40 138 46" stroke="url(#frameGrad)" strokeWidth="3"
                  strokeLinecap="round" fill="none" />
                <path d="M20 42 Q8 46 4 56" stroke="url(#frameGrad)" strokeWidth="3"
                  strokeLinecap="round" fill="none" />
                <path d="M220 42 Q232 46 236 56" stroke="url(#frameGrad)" strokeWidth="3"
                  strokeLinecap="round" fill="none" />
                <circle cx="108" cy="60" r="2" fill="#ffffff" opacity="0.9" />
                <circle cx="132" cy="60" r="2" fill="#ffffff" opacity="0.9" />
                <g fill="#ffffff" opacity="0.7">
                  <circle cx="48" cy="55" r="1.5" />
                  <circle cx="170" cy="58" r="1.2" />
                </g>
              </svg>
            </motion.div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10 max-w-lg mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <h2 className="text-4xl font-extrabold leading-[1.1] mb-4 tracking-tight">
              Manage optical orders<br />
              <span className="bg-gradient-to-r from-sky-200 via-white to-indigo-200 bg-clip-text text-transparent">
                with clarity and speed.
              </span>
            </h2>
            <p className="text-white/70 text-sm leading-relaxed max-w-md">
              A modern, secure system for tracking patient records, lens orders, and delivery status - all in one place.
            </p>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/50">
          <span>© {new Date().getFullYear()} Cynert Hospital. All rights reserved.</span>
          <span className="text-white/30">·</span>
          <a
            href="https://j-captain.github.io/jkarranja/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white/70 hover:text-white underline-offset-2 hover:underline transition-colors"
            title="Open in a new tab"
          >
            Powered by M.Josphat.K
          </a>
        </div>
      </motion.div>

      {/* ─────────── RIGHT: Form ─────────── */}
      <div className="flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-72 h-72 bg-sky-100 rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-100 rounded-full blur-3xl opacity-60" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm relative"
        >
          <div className="lg:hidden mb-6 flex justify-center"><Logo /></div>

          <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              Sign in to your account to continue.
            </p>
          </motion.div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-xl p-6 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.15)]">
            <form onSubmit={submit} className="space-y-4">
              <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
                <label className="label">Email</label>
                <div className="relative group">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                  <input
                    className="input !pl-9 transition-all focus:!ring-2 focus:!ring-sky-500/20"
                    type="email"
                    placeholder="Enter your Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </motion.div>

              <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
                <label className="label">Password</label>
                <div className="relative group">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                  <input
                    className="input !pl-9 !pr-11 transition-all focus:!ring-2 focus:!ring-sky-500/20"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </motion.div>

              <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.01 }}
                  whileTap={{ scale: loading ? 1 : 0.99 }}
                  className="relative overflow-hidden w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-indigo-600 text-white px-4 py-3 text-sm font-bold shadow-[0_8px_24px_-8px_rgba(99,102,241,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(99,102,241,0.7)] transition-shadow disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  {loading ? (
                    <span className="relative h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  ) : (
                    <>
                      <LogIn size={16} className="relative" />
                      <span className="relative">Sign In</span>
                      <ArrowRight size={14} className="relative opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </form>

            <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible" className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Need help signing in?
                </span>
              </div>
            </motion.div>

            <motion.div custom={5} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                onClick={openActivate}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-amber-100/60 text-amber-700 hover:from-amber-100 hover:to-amber-100 hover:border-amber-300 px-3 py-2.5 text-xs font-semibold transition-all shadow-sm hover:shadow-amber-200/50"
              >
                <Mail size={14} /> Activate
              </motion.button>
              <motion.button
                type="button"
                onClick={openReset}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-sky-100/60 text-sky-700 hover:from-sky-100 hover:to-sky-100 hover:border-sky-300 px-3 py-2.5 text-xs font-semibold transition-all shadow-sm hover:shadow-sky-200/50"
              >
                <KeyRound size={14} /> Reset
              </motion.button>
            </motion.div>
          </div>

          <motion.p custom={6} variants={fieldVariants} initial="hidden" animate="visible"
            className="text-[11px] text-slate-400 text-center mt-6">
            Protected by enterprise-grade security · <span className="font-semibold text-slate-500">Cynert Optical RMS</span>
          </motion.p>

          {/* Contact Us - sky-100 to match Reset's hover background */}
          <motion.div custom={7} variants={fieldVariants} initial="hidden" animate="visible"
            className="flex justify-center mt-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-100 text-sky-700 hover:border-sky-300 hover:bg-sky-200 px-4 py-1.5 text-[11px] font-semibold transition-all shadow-sm"
            >
              <Headset size={12} /> Contact Us
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* ─────────── MODALS - unchanged ─────────── */}
      <Modal open={inactiveOpen} onClose={() => setInactiveOpen(false)} title="Account Inactive" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-50 grid place-items-center ring-4 ring-amber-100">
            <ShieldAlert className="text-amber-600" size={28} />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-slate-800">Your account is not active yet</p>
            <p className="text-sm text-slate-500 mt-1">Complete activation and sign in.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => setInactiveOpen(false)}>Close</button>
            <button className="btn-primary" onClick={() => { setInactiveOpen(false); openActivate(); }}>
              <Mail size={14} /> Activate
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={actStage === 'email'} onClose={closeActivate} title="Activate Account" width="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            If you already have an activation code, paste it below.
            Otherwise, enter your email and we'll send a fresh code.
          </p>
          <div>
            <label className="label">Activation Code</label>
            <input
              className="input font-mono text-sm tracking-[0.4em] text-center uppercase"
              type="text"
              placeholder="ABCD1234"
              value={actCode}
              onChange={(e) => setActCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              maxLength={8}
              autoComplete="one-time-code"
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1">
              8-character code (4 letters + 4 numbers). Expires in <strong>5 minutes</strong>.
            </p>
          </div>
          <div className="flex justify-end pt-1">
            <button className="btn-primary" onClick={submitActivationCode} disabled={actWorking || actCode.length !== 8}>
              {actWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (<><ShieldCheck size={14} /> Activate Now</>)}
            </button>
          </div>
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Or, need a new code?
              </span>
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={actEmail} onChange={(e) => setActEmail(e.target.value)} placeholder="Enter your account email" />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={closeActivate} disabled={actWorking}>Cancel</button>
            <button className="btn-primary" onClick={resendActivation} disabled={actWorking}>
              {actWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (<><Mail size={14} /> Send Code</>)}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={actStage === 'sent'} onClose={closeActivate} title="Activation Email Sent" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 grid place-items-center ring-4 ring-emerald-100">
            <CheckCircle2 className="text-emerald-600" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">Check your inbox</p>
            <p className="text-xs text-slate-500 mt-1">
              An activation email has been sent to <span className="font-semibold text-slate-700">{actEmail}</span>.
              It expires in <strong>5 minutes</strong>.
            </p>
          </div>
          {actMeta?.remaining !== undefined && (
            <p className="text-[11px] text-slate-500 text-center">
              <Clock size={11} className="inline mr-1 -mt-0.5" />
              {actMeta.remaining > 0
                ? `You have ${actMeta.remaining} resend${actMeta.remaining === 1 ? '' : 's'} left in this 30-minute window.`
                : 'No resends left in this window. Wait 30 minutes before requesting again.'}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={closeActivate}>Done</button>
            <button className="btn-primary" onClick={() => { setActCode(''); setActStage('email'); }}>
              <ShieldCheck size={14} /> Activate Now
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={actStage === 'throttled'} onClose={closeActivate} title="Please Wait" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-50 grid place-items-center ring-4 ring-amber-100">
            <Clock className="text-amber-600" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">Too many requests</p>
            <p className="text-xs text-slate-500 mt-1">
              You've requested the maximum number of activation emails for this window.
              Please try again {formatRetry(actMeta?.retryAfter)}.
            </p>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={closeActivate}>Got it</button>
          </div>
        </div>
      </Modal>

      <Modal open={actStage === 'notFound'} onClose={closeActivate} title="Account Not Found" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-slate-100 grid place-items-center ring-4 ring-slate-50">
            <UserX className="text-slate-500" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">No account found</p>
            <p className="text-xs text-slate-500 mt-1">
              We couldn't find an account registered with <span className="font-semibold text-slate-700">{actEmail}</span>.
              Check the spelling and try again, or contact your administrator.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={closeActivate}>Close</button>
            <button className="btn-primary" onClick={() => setActStage('email')}>
              <Mail size={14} /> Try Again
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={actStage === 'alreadyActive'} onClose={closeActivate} title="Account Already Active" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 grid place-items-center ring-4 ring-emerald-100">
            <UserCheck className="text-emerald-600" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">Your account is already active</p>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-semibold text-slate-700">{actEmail}</span> is active.
              You can sign in now - no activation needed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={closeActivate}>Close</button>
            <button className="btn-primary" onClick={() => { closeActivate(); setEmail(actEmail); }}>
              <LogIn size={14} /> Login
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={rstStage === 'email'} onClose={closeReset} title="Reset Password" width="max-w-md">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Enter your account email and we'll send a password-reset code.
            Codes expire in <strong>5 minutes</strong>.
          </p>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
            <strong className="text-slate-600">Requirements:</strong> the account must be active,
            at least 24 hours old, and not exceed 2 resets in the last 7 days.
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={rstEmail} onChange={(e) => setRstEmail(e.target.value)} autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={closeReset} disabled={rstWorking}>Cancel</button>
            <button className="btn-primary" onClick={requestReset} disabled={rstWorking}>
              {rstWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (<><KeyRound size={14} /> Send Reset Code</>)}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={rstStage === 'sent'} onClose={closeReset} title="Reset Email Sent" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 grid place-items-center ring-4 ring-emerald-100">
            <CheckCircle2 className="text-emerald-600" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">Check your inbox</p>
            <p className="text-xs text-slate-500 mt-1">
              If an eligible account exists for <span className="font-semibold text-slate-700">{rstEmail}</span>,
              a reset email has been sent. It expires in <strong>5 minutes</strong>.
            </p>
          </div>
          {rstMeta?.remaining !== undefined && (
            <p className="text-[11px] text-slate-500 text-center">
              <Clock size={11} className="inline mr-1 -mt-0.5" />
              {rstMeta.remaining > 0
                ? `You have ${rstMeta.remaining} reset${rstMeta.remaining === 1 ? '' : 's'} left in the 7-day window.`
                : 'No resets left in this 7-day window.'}
            </p>
          )}
          <div className="flex justify-end">
            <button className="btn-primary" onClick={closeReset}>Done</button>
          </div>
        </div>
      </Modal>

      <Modal open={rstStage === 'inactive'} onClose={closeReset} title="Account Inactive" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-50 grid place-items-center ring-4 ring-amber-100">
            <ShieldAlert className="text-amber-600" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">Activate your account first</p>
            <p className="text-xs text-slate-500 mt-1">
              Password reset is disabled for inactive accounts. Please activate your account
              first, then return here to reset your password.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={closeReset}>Close</button>
            <button className="btn-primary" onClick={() => { closeReset(); openActivate(); }}>
              <Mail size={14} /> Activate
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={rstStage === 'tooEarly'} onClose={closeReset} title="Too Soon" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-sky-50 grid place-items-center ring-4 ring-sky-100">
            <Clock className="text-sky-600" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">Account too new</p>
            <p className="text-xs text-slate-500 mt-1">
              Password resets are available 24 hours after account creation.
              Please try again {formatRetry(rstMeta?.retryAfter)}.
            </p>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={closeReset}>Got it</button>
          </div>
        </div>
      </Modal>

      <Modal open={rstStage === 'throttled'} onClose={closeReset} title="Please Wait" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-50 grid place-items-center ring-4 ring-amber-100">
            <Clock className="text-amber-600" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">Too many resets</p>
            <p className="text-xs text-slate-500 mt-1">
              You've reached the maximum of 2 password resets in the last 7 days.
              Please try again {formatRetry(rstMeta?.retryAfter)}.
            </p>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={closeReset}>Got it</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Login;