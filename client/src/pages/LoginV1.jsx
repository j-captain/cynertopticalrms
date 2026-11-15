import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LogIn, Eye, EyeOff, Mail, KeyRound, ShieldAlert, ShieldCheck,
  CheckCircle2, Clock, UserX, UserCheck,
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

  // ── Inactive modal ──
  const [inactiveOpen, setInactiveOpen] = useState(false);

  // ── Activate Account flow ──
  // stage: null | 'email' | 'sent' | 'throttled' | 'notFound' | 'alreadyActive'
  const [actStage, setActStage] = useState(null);
  const [actEmail, setActEmail] = useState('');
  const [actCode, setActCode] = useState('');
  const [actWorking, setActWorking] = useState(false);
  const [actMeta, setActMeta] = useState(null);

  // ── Reset Password flow ──
  // stage: null | 'email' | 'sent' | 'throttled' | 'inactive' | 'tooEarly'
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

  /* ── Activate Account ── */
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
      setActMeta({
        remaining: r.data.remaining,
        nextAllowedAt: r.data.nextAllowedAt,
      });
      setActStage('sent');
    } catch (err) {
      const d = err.response?.data;
      if (d?.code === 'ACCOUNT_NOT_FOUND') {
        setActStage('notFound');
      } else if (d?.code === 'ACCOUNT_ALREADY_ACTIVE') {
        setActStage('alreadyActive');
      } else if (err.response?.status === 429 && d?.code === 'ACTIVATION_RESEND_LIMIT') {
        setActMeta({ retryAfter: d.retryAfter });
        setActStage('throttled');
      } else {
        toast.error(d?.message || 'Could not send activation email');
      }
    } finally {
      setActWorking(false);
    }
  };

  /* ── Reset Password ── */
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
      if (d?.code === 'ACCOUNT_INACTIVE') {
        setRstStage('inactive');
      } else if (d?.code === 'RESET_TOO_EARLY') {
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

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openActivate}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 hover:text-amber-800 px-3 py-2.5 text-xs font-semibold transition"
            >
              <Mail size={14} /> Activate
            </button>
            <button
              type="button"
              onClick={openReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300 hover:text-sky-800 px-3 py-2.5 text-xs font-semibold transition"
            >
              <KeyRound size={14} /> Reset
            </button>
          </div>
        </motion.div>
      </div>

      {/* ─── Inactive account modal ─── */}
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
            <button
              className="btn-primary"
              onClick={() => {
                setInactiveOpen(false);
                openActivate();
              }}
            >
              <Mail size={14} /> Activate
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Activate - enter code OR send new ─── */}
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
              onChange={(e) =>
                setActCode(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
                )
              }
              maxLength={8}
              autoComplete="one-time-code"
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1">
              8-character code (4 letters + 4 numbers). Expires in <strong>5 minutes</strong>.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <button
              className="btn-primary"
              onClick={submitActivationCode}
              disabled={actWorking || actCode.length !== 8}
            >
              {actWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><ShieldCheck size={14} /> Activate Now</>
              )}
            </button>
          </div>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Or, need a new code?
              </span>
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={actEmail}
              onChange={(e) => setActEmail(e.target.value)}
              placeholder="Enter your account email"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={closeActivate} disabled={actWorking}>Cancel</button>
            <button className="btn-primary" onClick={resendActivation} disabled={actWorking}>
              {actWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Mail size={14} /> Send Code</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Activation email sent ─── */}
      <Modal open={actStage === 'sent'} onClose={closeActivate} title="Activation Email Sent" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 grid place-items-center ring-4 ring-emerald-100">
            <CheckCircle2 className="text-emerald-600" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">Check your inbox</p>
            <p className="text-xs text-slate-500 mt-1">
              An activation email has been sent to{' '}
              <span className="font-semibold text-slate-700">{actEmail}</span>.
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
            <button
              className="btn-primary"
              onClick={() => {
                setActCode('');
                setActStage('email');
              }}
            >
              <ShieldCheck size={14} /> Activate Now
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Throttled ─── */}
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

      {/* ─── Account not found ─── */}
      <Modal open={actStage === 'notFound'} onClose={closeActivate} title="Account Not Found" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-slate-100 grid place-items-center ring-4 ring-slate-50">
            <UserX className="text-slate-500" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">No account found</p>
            <p className="text-xs text-slate-500 mt-1">
              We couldn't find an account registered with{' '}
              <span className="font-semibold text-slate-700">{actEmail}</span>.
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

      {/* ─── Account already active ─── */}
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
            <button
              className="btn-primary"
              onClick={() => {
                closeActivate();
                setEmail(actEmail);
              }}
            >
              <LogIn size={14} /> Login
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Reset Password flow ─── */}
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
            <input
              className="input"
              type="email"
              value={rstEmail}
              onChange={(e) => setRstEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={closeReset} disabled={rstWorking}>Cancel</button>
            <button className="btn-primary" onClick={requestReset} disabled={rstWorking}>
              {rstWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><KeyRound size={14} /> Send Reset Code</>
              )}
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
            <button
              className="btn-primary"
              onClick={() => {
                closeReset();
                openActivate();
              }}
            >
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