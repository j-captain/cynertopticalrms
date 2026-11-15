import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Pencil, Truck, Save, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const OpticianBilled = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  /* ── Deliver ── */
  const [deliverTarget, setDeliverTarget] = useState(null);
  const [deliverGateOpen, setDeliverGateOpen] = useState(false);
  const [delivering, setDelivering] = useState(false);

  /* ── Edit bill - 3-stage: gate → form → confirm ── */
  const [editTarget, setEditTarget] = useState(null);       // form
  const [editGateTarget, setEditGateTarget] = useState(null); // gate
  const [confirmEditTarget, setConfirmEditTarget] = useState(null);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [form, setForm] = useState({ lenses: '', frame: '', fitting: '', caseAmount: '', fargo: '' });
  const [saving, setSaving] = useState(false);

  /* ── Success ── */
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/billing/optician/billed', { params: { q } });
      setRows(r.data);
    } catch {
      toast.error('Failed to load billed orders');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  /* ──────────────── DELIVER - GATE ──────────────── */
  const openDeliverGate = (p) => {
    setDeliverTarget(p);
    setDeliverGateOpen(true);
  };

  const confirmDeliver = async () => {
    if (!deliverTarget) return;
    setDelivering(true);
    try {
      await api.post(`/billing/optician/${deliverTarget._id}/deliver`);
      setSuccessMsg(`${deliverTarget.patientName} marked delivered.`);
      setDeliverGateOpen(false);
      setDeliverTarget(null);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Deliver failed');
    } finally {
      setDelivering(false);
    }
  };

  /* ──────────────── EDIT - GATE ──────────────── */
  const openEditGate = (p) => {
    setEditGateTarget(p);
  };

  const proceedToEditForm = () => {
    if (!editGateTarget) return;
    const p = editGateTarget;
    const b = p.billing || {};
    setEditGateTarget(null);
    setEditTarget(p);
    setForm({
      lenses: String(b.lenses ?? ''),
      frame: String(b.frame ?? ''),
      fitting: String(b.fitting ?? ''),
      caseAmount: String(b.caseAmount ?? ''),
      fargo: String(b.fargo ?? ''),
    });
  };

  const closeEditForm = () => {
    if (!saving) setEditTarget(null);
  };

  /* ──────────────── EDIT - FORM ──────────────── */
  const editTotal = Object.values(form).reduce((s, v) => s + (Number(v) || 0), 0);

  const proceedEdit = () => {
    setConfirmEditTarget(editTarget);
    setEditTarget(null);
    setEditConfirmOpen(true);
  };

  const confirmEdit = async () => {
    if (!confirmEditTarget) return;
    setSaving(true);
    try {
      await api.put(`/billing/optician/${confirmEditTarget._id}/edit-bill`, form);
      setSuccessMsg(`Bill updated for ${confirmEditTarget.patientName}.`);
      setEditConfirmOpen(false);
      setConfirmEditTarget(null);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Edit failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Billed Orders</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Billed but not yet delivered. Edit or deliver.
        </p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !py-2 !pl-8 !text-xs"
          placeholder="Search patient, system no., lens, frame…"
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
                <th className="px-2 py-2 text-right font-semibold">Bill Total</th>
                <th className="px-2 py-2 text-left font-semibold">Billed By</th>
                <th className="px-2 py-2 text-left font-semibold">Billed At</th>
                <th className="px-2 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">No billed orders pending delivery.</td></tr>}
              {rows.map((p) => (
                <motion.tr
                  key={p._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-t border-slate-100 hover:bg-sky-50/40"
                >
                  <td className="px-2 py-1.5 text-slate-400 tabular-nums">{p.index}</td>
                  <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap max-w-[160px] truncate" title={p.patientName}>
                    {p.patientName}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[160px] truncate" title={p.lensType || ''}>
                    {p.lensType || '-'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[140px] truncate" title={p.frameCode || ''}>
                    {p.frameCode || '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-sky-600 tabular-nums">
                    {money(p.billing?.total)}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">
                    {p.billing?.billedByName || '-'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                    {p.billing?.billedAt ? fmtDate(p.billing.billedAt) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditGate(p)}
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit bill"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => openDeliverGate(p)}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-600 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 transition"
                        title="Mark delivered"
                      >
                        <Truck size={10} /> Deliver
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────── EDIT - GATE ─────────── */}
      <Modal
        open={!!editGateTarget}
        onClose={() => setEditGateTarget(null)}
        title="Edit Bill"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            <Pencil className="text-sky-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Edit the bill for <span className="font-semibold">{editGateTarget?.patientName}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              You'll be able to adjust the five amount fields. The billed-by and billed-at will be preserved.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Lens Type</span>
              <span className="font-semibold text-slate-800">{editGateTarget?.lensType || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Frame Code</span>
              <span className="font-semibold text-slate-800">{editGateTarget?.frameCode || '-'}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-500">Current Total</span>
              <span className="font-semibold text-sky-600">
                {money(editGateTarget?.billing?.total)}
              </span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setEditGateTarget(null)}>Cancel</button>
            <button className="btn-primary" onClick={proceedToEditForm}>
              <Pencil size={14} /> Continue
            </button>
          </div>
        </div>
      </Modal>

      {/* ─────────── EDIT - FORM ─────────── */}
      <Modal open={!!editTarget} onClose={closeEditForm} title="Edit Bill" width="max-w-lg">
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Patient</span><span className="font-semibold text-slate-800">{editTarget?.patientName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Lens Type</span><span className="font-semibold text-slate-800">{editTarget?.lensType || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Frame Code</span><span className="font-semibold text-slate-800">{editTarget?.frameCode || '-'}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['lenses', 'Lenses Pair (KES)'],
              ['frame', 'Frame (KES)'],
              ['fitting', 'Fitting (KES)'],
              ['caseAmount', 'Case (KES)'],
              ['fargo', 'Fargo (KES)'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  type="number" min="0" className="input"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <label className="label">Total (auto)</label>
              <div className="input !bg-slate-50 !text-slate-700 font-semibold">{money(editTotal)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={closeEditForm} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={proceedEdit} disabled={saving}>
              <Save size={14} /> Continue
            </button>
          </div>
        </div>
      </Modal>

      {/* ─────────── EDIT - CONFIRM ─────────── */}
      <Modal
        open={!!editConfirmOpen}
        onClose={() => !saving && setEditConfirmOpen(false)}
        title="Confirm Bill Update"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 grid place-items-center">
            <ShieldAlert className="text-amber-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Save changes to <span className="font-semibold">{confirmEditTarget?.patientName}</span>'s bill?
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Lenses</span><span className="font-semibold text-slate-800">{money(Number(form.lenses) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Frame</span><span className="font-semibold text-slate-800">{money(Number(form.frame) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fitting</span><span className="font-semibold text-slate-800">{money(Number(form.fitting) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Case</span><span className="font-semibold text-slate-800">{money(Number(form.caseAmount) || 0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fargo</span><span className="font-semibold text-slate-800">{money(Number(form.fargo) || 0)}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-semibold">New Total</span>
              <span className="font-bold text-sky-600">{money(editTotal)}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setEditConfirmOpen(false)} disabled={saving}>Back</button>
            <button className="btn-primary" onClick={confirmEdit} disabled={saving}>
              {saving ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Save size={14} /> Save Changes</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─────────── DELIVER - GATE ─────────── */}
      <Modal
        open={deliverGateOpen}
        onClose={() => !delivering && setDeliverGateOpen(false)}
        title="Mark Delivered"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-violet-50 grid place-items-center">
            <Truck className="text-violet-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Mark <span className="font-semibold">{deliverTarget?.patientName}</span> as delivered?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              This confirms the order has left the lab and reached the customer. It will move to the director's Paid Orders view.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Lens Type</span><span className="font-semibold text-slate-800">{deliverTarget?.lensType || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Frame Code</span><span className="font-semibold text-slate-800">{deliverTarget?.frameCode || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Bill Total</span><span className="font-semibold text-sky-600">{money(deliverTarget?.billing?.total)}</span></div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDeliverGateOpen(false)} disabled={delivering}>Cancel</button>
            <button className="btn-primary" onClick={confirmDeliver} disabled={delivering}>
              {delivering ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Truck size={14} /> Deliver</>
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

export default OpticianBilled;