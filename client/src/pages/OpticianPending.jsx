import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ClipboardList, Save, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

/* ────────────────────────────────────────────────────────────────── */
/* Detail popover - below the clicked cell, with real animation       */
/* ────────────────────────────────────────────────────────────────── */
const RowDetail = ({ patient, anchorRect, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const cardW = Math.min(360, typeof window !== 'undefined' ? window.innerWidth - 24 : 360);
  const gap = 8;

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Anchor to the clicked cell's left edge
  let left = anchorRect.left + 50;

  // If it would overflow right, slide left until it fits
  if (left + cardW > viewportW - 12) left = viewportW - 12 - cardW;
  // If it would overflow left, clamp
  if (left < 12) left = 12;

  // Always below the clicked cell
  const estimatedH = 150;
  let top = anchorRect.bottom + gap;
  // If it would overflow the bottom, place above the cell
  if (top + estimatedH > viewportH - 12) {
    top = Math.max(12, anchorRect.top - estimatedH - gap);
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -8, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.7 }}
      style={{
        position: 'fixed',
        top,
        left,
        width: cardW,
        transformOrigin: 'top left',
      }}
      className="z-50 rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 space-y-3 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Patient</p>
          <p className="text-sm font-bold text-slate-800 leading-snug break-words">
            {patient.patientName || '-'}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Lens Type</p>
          <p className="text-sm text-slate-700 leading-snug break-words">
            {patient.lensType || '-'}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Frame Code</p>
          <p className="text-sm font-mono text-slate-700 leading-snug break-words">
            {patient.frameCode || '-'}
          </p>
        </div>
      </div>

      <button
        onClick={onClose}
        className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-white border border-slate-200 shadow-sm grid place-items-center text-slate-500 hover:text-slate-800 hover:border-slate-300 transition"
        aria-label="Close"
      >
        <X size={11} />
      </button>
    </motion.div>
  );
};

const OpticianPending = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ lenses: '', frame: '', fitting: '', caseAmount: '', fargo: '' });
  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  /* ── New: gate + confirm ── */
  const [gateTarget, setGateTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Each detail has a unique `id` per open, so AnimatePresence sees a
  // real mount → exit → remount cycle every time.
  const [detail, setDetail] = useState(null); // { id, patient, anchorRect }

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/billing/optician/pending', { params: { q } });
      setRows(r.data);
      setDetail(null);
    } catch {
      toast.error('Failed to load pending orders');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  /* ──────────────── BILL - GATE ──────────────── */
  const openBillGate = (p) => {
    setDetail(null);
    setGateTarget(p);
  };

  const proceedToBillForm = () => {
    if (!gateTarget) return;
    setTarget(gateTarget);
    setForm({ lenses: '', frame: '', fitting: '', caseAmount: '', fargo: '' });
    setGateTarget(null);
  };

  /* ──────────────── BILL - FORM ──────────────── */
  const total = Object.values(form).reduce((s, v) => s + (Number(v) || 0), 0);

  const proceedToConfirm = () => {
    setConfirmTarget(target);
    setTarget(null);
    setConfirmOpen(true);
  };

  /* ──────────────── BILL - CONFIRM ──────────────── */
  const confirmBill = async () => {
    if (!confirmTarget) return;
    setSaving(true);
    try {
      await api.post(`/billing/optician/${confirmTarget._id}/bill`, form);
      setSuccessMsg(`Bill of ${money(total)} submitted for ${confirmTarget.patientName}.`);
      setConfirmOpen(false);
      setConfirmTarget(null);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Bill failed');
    } finally {
      setSaving(false);
    }
  };

  /* Open the popover anchored to the clicked CELL, below it */
  const openDetail = useCallback((p, trEl, cellEl) => {
    const rect = cellEl.getBoundingClientRect();
    setDetail((cur) => {
      // Toggle: clicking the same patient closes
      if (cur && cur.patient._id === p._id) return null;
      return {
        // Unique id per open - forces AnimatePresence to run the
        // enter/exit cycle on every click, so the animation is always seen
        id: `${p._id}-${Date.now()}`,
        patient: p,
        anchorRect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          height: rect.height,
        },
      };
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Pending Orders</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Orders awaiting billing. Click a patient, lens type, or frame code to see full details.
        </p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !py-2 !pl-8 !text-xs"
          placeholder="Search patient, lens, frame, insurance…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">Patient</th>
                <th className="px-2 py-2 text-left font-semibold">Lens Type</th>
                <th className="px-2 py-2 text-left font-semibold">Frame Code</th>
                <th className="px-2 py-2 text-left font-semibold">Scheme</th>
                <th className="px-2 py-2 text-left font-semibold">Insurance</th>
                <th className="px-2 py-2 text-left font-semibold">Submitted</th>
                <th className="px-2 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">No pending orders.</td></tr>
              )}
              {rows.map((p) => {
                const submittedAt = p.submissionDate || p.orderedAt || p.createdAt;
                const isOpen = detail?.patient?._id === p._id;
                const clickableProps = (e) =>
                  openDetail(p, e.currentTarget.closest('tr'), e.currentTarget);
                return (
                  <motion.tr
                    key={p._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`border-t border-slate-100 transition ${
                      isOpen ? 'bg-amber-50/60' : 'hover:bg-amber-50/40'
                    }`}
                  >
                    <td className="px-2 py-1.5 text-slate-400 tabular-nums">{p.index}</td>
                    <td
                      onClick={clickableProps}
                      className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap max-w-[180px] truncate cursor-pointer"
                      title={p.patientName}
                    >
                      {p.patientName}
                    </td>
                    <td
                      onClick={clickableProps}
                      className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[140px] truncate cursor-pointer"
                      title={p.lensType || ''}
                    >
                      {p.lensType || '-'}
                    </td>
                    <td
                      onClick={clickableProps}
                      className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[120px] truncate cursor-pointer"
                      title={p.frameCode || ''}
                    >
                      {p.frameCode || '-'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span className={`badge ${p.scheme === 'Insurance' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {p.scheme === 'Insurance' ? 'Insurance' : 'Cash'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[160px] truncate" title={p.insurance || ''}>
                      {p.scheme === 'Insurance' ? (p.insurance || '-') : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                      {submittedAt ? fmtDate(submittedAt) : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); openBillGate(p); }}
                        className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-2 py-1 text-[10px] font-semibold hover:shadow-md hover:-translate-y-0.5 transition"
                      >
                        <ClipboardList size={10} /> Bill
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key changes with every open → guaranteed animation */}
      <AnimatePresence mode="wait">
        {detail && (
          <RowDetail
            key={detail.id}
            patient={detail.patient}
            anchorRect={detail.anchorRect}
            onClose={() => setDetail(null)}
          />
        )}
      </AnimatePresence>

      {/* ─────────── BILL - GATE ─────────── */}
      <Modal
        open={!!gateTarget}
        onClose={() => setGateTarget(null)}
        title="Enter Bill"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            <ClipboardList className="text-sky-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Enter a bill for <span className="font-semibold">{gateTarget?.patientName}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              You'll be able to enter the lenses, frame, fitting, case, and fargo amounts on the next step.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Lens Type</span>
              <span className="font-semibold text-slate-800">{gateTarget?.lensType || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Frame Code</span>
              <span className="font-semibold text-slate-800">{gateTarget?.frameCode || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Scheme</span>
              <span className="font-semibold text-slate-800">
                {gateTarget?.scheme === 'Insurance' ? 'Insurance' : 'Cash'}
              </span>
            </div>
            {gateTarget?.scheme === 'Insurance' && (
              <div className="flex justify-between">
                <span className="text-slate-500">Insurance</span>
                <span className="font-semibold text-slate-800">{gateTarget?.insurance || '-'}</span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setGateTarget(null)}>Cancel</button>
            <button className="btn-primary" onClick={proceedToBillForm}>
              <ClipboardList size={14} /> Continue
            </button>
          </div>
        </div>
      </Modal>

      {/* ─────────── BILL - FORM (unchanged except submit label + handler) ─────────── */}
      <Modal open={!!target} onClose={() => !saving && setTarget(null)} title="Enter Bill" width="max-w-lg">
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Patient</span>
              <span className="font-semibold text-slate-800">{target?.patientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Lens Type</span>
              <span className="font-semibold text-slate-800">{target?.lensType || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Frame Code</span>
              <span className="font-semibold text-slate-800">{target?.frameCode || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Scheme</span>
              <span className="font-semibold text-slate-800">
                {target?.scheme === 'Insurance' ? 'Insurance' : 'Cash'}
              </span>
            </div>
            {target?.scheme === 'Insurance' && (
              <div className="flex justify-between">
                <span className="text-slate-500">Insurance</span>
                <span className="font-semibold text-slate-800">{target?.insurance || '-'}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Submitted</span>
              <span className="font-semibold text-slate-800">
                {target?.submissionDate || target?.orderedAt
                  ? fmtDate(target.submissionDate || target.orderedAt)
                  : '-'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lenses Pair (KES)</label>
              <input
                type="number" min="0" className="input"
                value={form.lenses}
                onChange={(e) => setForm({ ...form, lenses: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Frame (KES)</label>
              <input
                type="number" min="0" className="input"
                value={form.frame}
                onChange={(e) => setForm({ ...form, frame: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Fitting (KES)</label>
              <input
                type="number" min="0" className="input"
                value={form.fitting}
                onChange={(e) => setForm({ ...form, fitting: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Case (KES)</label>
              <input
                type="number" min="0" className="input"
                value={form.caseAmount}
                onChange={(e) => setForm({ ...form, caseAmount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Fargo (KES)</label>
              <input
                type="number" min="0" className="input"
                value={form.fargo}
                onChange={(e) => setForm({ ...form, fargo: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Total (auto)</label>
              <div className="input !bg-slate-50 !text-slate-700 font-semibold">{money(total)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setTarget(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={proceedToConfirm} disabled={saving}>
              <Save size={14} /> Continue
            </button>
          </div>
        </div>
      </Modal>

      {/* ─────────── BILL - CONFIRM ─────────── */}
      <Modal
        open={!!confirmOpen}
        onClose={() => !saving && setConfirmOpen(false)}
        title="Confirm Bill"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 grid place-items-center">
            <ShieldAlert className="text-amber-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Submit a bill of <span className="font-bold text-sky-600">{money(total)}</span> for{' '}
              <span className="font-semibold">{confirmTarget?.patientName}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              The order will move to "Billed" and appear on the director's Unpaid Orders page.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Lenses</span><span className="font-semibold text-slate-800">{money(Number(form.lenses) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Frame</span><span className="font-semibold text-slate-800">{money(Number(form.frame) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fitting</span><span className="font-semibold text-slate-800">{money(Number(form.fitting) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Case</span><span className="font-semibold text-slate-800">{money(Number(form.caseAmount) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fargo</span><span className="font-semibold text-slate-800">{money(Number(form.fargo) || 0)}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-semibold">Total</span>
              <span className="font-bold text-sky-600">{money(total)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>Back</button>
            <button className="btn-primary" onClick={confirmBill} disabled={saving}>
              {saving ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Save size={14} /> Submit Bill</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Success"
        message={successMsg}
      />
    </div>
  );
};

export default OpticianPending;