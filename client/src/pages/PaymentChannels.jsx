import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Save, Power, AlertTriangle, CreditCard,
  CheckCircle2, ShieldAlert, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';

const PROVIDERS = [
  { value: 'M-Pesa Paybill', label: 'M-Pesa Paybill' },
  { value: 'M-Pesa Till', label: 'M-Pesa Till' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Cash', label: 'Cash' },
];

/* ────────────────────────────────────────────────────────────────── */
/* Sanitize before storing in DB:                                    */
/*   - Pure digits → strip all spaces (DB holds "7597039")           */
/*   - Letters present → collapse multiples, keep single spaces      */
/*     (DB holds "CYNERT HOSPITAL", not "CYNERTHOSPITAL")            */
/* ────────────────────────────────────────────────────────────────── */
const sanitizeNumber = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed.replace(/\s+/g, ''))) {
    return trimmed.replace(/\s+/g, '');
  }
  return trimmed.replace(/\s+/g, ' ').trim();
};

/* ────────────────────────────────────────────────────────────────── */
/* Format for display:                                               */
/*   - Pure digits → readable grouping ("7597039" → "75 97 039")     */
/*   - Letters present → show as-is (spaces preserved)                */
/* ────────────────────────────────────────────────────────────────── */
const formatBusinessNumber = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '-';

  if (!/^\d+$/.test(trimmed.replace(/\s+/g, ''))) {
    return trimmed.replace(/\s+/g, ' ').trim();
  }

  const digits = trimmed.replace(/\s+/g, '');
  if (digits.length === 7) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  if (digits.length === 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length === 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length > 7) {
    const chunks = [];
    let i = digits.length;
    while (i > 0) {
      const size = i === digits.length && i % 2 === 1 ? 3 : 2;
      const start = Math.max(0, i - size);
      chunks.unshift(digits.slice(start, i));
      i = start;
    }
    return chunks.join(' ');
  }
  return digits;
};

const emptyForm = {
  provider: 'M-Pesa Paybill',
  name: '',
  businessNumber: '',
  accountNumber: '',
  active: true,
};

const PaymentChannels = () => {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Create ── */
  const [form, setForm] = useState(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);

  /* ── Edit (gate → form → confirm) ── */
  const [editTarget, setEditTarget] = useState(null);         // edit form open
  const [editForm, setEditForm] = useState(emptyForm);
  const [editGateTarget, setEditGateTarget] = useState(null); // gate open
  const [confirmEditTarget, setConfirmEditTarget] = useState(null); // for the confirm step
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);

  /* ── Toggle ── */
  const [toggleTarget, setToggleTarget] = useState(null);

  /* ── Delete ── */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteText, setDeleteText] = useState('');

  /* ── Director: detail view ── */
  const [detailTarget, setDetailTarget] = useState(null);

  /* ── Shared ── */
  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const DELETE_WORD = 'DELETE';

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/payment-channels');
      setRows(r.data);
    } catch {
      toast.error('Failed to load payment channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  if (authLoading) {
    return <div className="card p-6 text-center text-sm text-slate-500">Loading…</div>;
  }

  /* ──────────────── CREATE ──────────────── */
  const openCreate = () => {
    if (!isAdmin) return;
    setForm(emptyForm);
    setCreateOpen(true);
  };

  const proceedCreate = () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setCreateOpen(false);
    setCreateConfirmOpen(true);
  };

  const confirmCreate = async () => {
    setSaving(true);
    try {
      await api.post('/payment-channels', {
        ...form,
        businessNumber: sanitizeNumber(form.businessNumber),
        accountNumber: sanitizeNumber(form.accountNumber),
      });
      setCreateConfirmOpen(false);
      setSuccessMsg(`Payment channel "${form.name}" created successfully.`);
      setSuccessOpen(true);
      setForm(emptyForm);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  /* ──────────────── EDIT - GATE ──────────────── */
  const openEditGate = (c) => {
    if (!isAdmin) return;
    setEditGateTarget(c);
  };

  const proceedToEditForm = () => {
    if (!editGateTarget) return;
    const c = editGateTarget;
    setEditGateTarget(null);
    setEditTarget(c);
    setEditForm({
      provider: c.provider || 'M-Pesa Paybill',
      name: c.name || '',
      businessNumber: c.businessNumber || '',
      accountNumber: c.accountNumber || '',
      active: c.active !== false,
    });
  };

  /* ──────────────── EDIT - FORM ──────────────── */
  const proceedEdit = () => {
    if (!editForm.name.trim()) return toast.error('Name is required');
    setConfirmEditTarget(editTarget);
    setEditTarget(null);
    setEditConfirmOpen(true);
  };

  const confirmEdit = async () => {
    if (!confirmEditTarget) return;
    setSaving(true);
    try {
      await api.put(`/payment-channels/${confirmEditTarget._id}`, {
        ...editForm,
        businessNumber: sanitizeNumber(editForm.businessNumber),
        accountNumber: sanitizeNumber(editForm.accountNumber),
      });
      setEditConfirmOpen(false);
      setSuccessMsg(`Payment channel "${editForm.name}" updated successfully.`);
      setSuccessOpen(true);
      setConfirmEditTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  /* ──────────────── TOGGLE ──────────────── */
  const openToggle = (c) => {
    if (!isAdmin) return;
    setToggleTarget(c);
  };

  const confirmToggle = async () => {
    if (!toggleTarget) return;
    setSaving(true);
    try {
      await api.post(`/payment-channels/${toggleTarget._id}/toggle`);
      const willBeActive = !toggleTarget.active;
      setSuccessMsg(
        `"${toggleTarget.name}" ${willBeActive ? 'activated' : 'deactivated'} successfully.`
      );
      setToggleTarget(null);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Toggle failed');
    } finally {
      setSaving(false);
    }
  };

  /* ──────────────── DELETE ──────────────── */
  const openDelete = (c) => {
    if (!isAdmin) return;
    setDeleteTarget(c);
    setDeleteText('');
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/payment-channels/${deleteTarget._id}`);
      setSuccessMsg(`Payment channel "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      setDeleteText('');
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  /* ──────────────── DIRECTOR DETAIL ──────────────── */
  const openDetail = (c) => {
    if (isAdmin) return;
    setDetailTarget(c);
  };

  /* ─── Shared form fields ─── */
  const FormFields = ({ value, onChange, mode }) => (
    <>
      <div>
        <label className="label">Provider</label>
        <select
          className="input"
          value={value.provider}
          onChange={(e) => onChange({ ...value, provider: e.target.value })}
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Name</label>
        <input
          className="input"
          placeholder="e.g. Lipa Na M-Pesa"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          The label shown to users when they choose how to pay.
        </p>
      </div>
      <div>
        <label className="label">Business Number (Paybill / Till)</label>
        <input
          className="input font-mono"
          placeholder="e.g. 7597039"
          value={value.businessNumber}
          onChange={(e) => onChange({ ...value, businessNumber: e.target.value })}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Numeric codes ignore spaces. Word-based codes keep them.
        </p>
      </div>
      <div>
        <label className="label">Account Number</label>
        <input
          className="input font-mono"
          placeholder="e.g. CYNERT HOSPITAL"
          value={value.accountNumber}
          onChange={(e) => onChange({ ...value, accountNumber: e.target.value })}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Words keep spaces - safe to type "CYNERT HOSPITAL".
        </p>
      </div>
      {mode === 'edit' && (
        <div>
          <label className="label flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.active}
              onChange={(e) => onChange({ ...value, active: e.target.checked })}
              className="accent-emerald-500"
            />
            <span>Active (visible on payment page)</span>
          </label>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Payment Channels</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Configure how you receive payments. Only active channels are shown to customers.'
              : 'Click any channel to see its full details.'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={14} /> Add Channel
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left font-semibold">Provider</th>
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-left font-semibold">Business No.</th>
                <th className="px-3 py-2 text-left font-semibold">Account No.</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                {isAdmin && <th className="px-3 py-2 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-400">Loading…</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-slate-400">
                    {isAdmin
                      ? 'No payment channels yet. Click "Add Channel" to create one.'
                      : 'No payment channels have been configured yet.'}
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <motion.tr
                  key={c._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => openDetail(c)}
                  className={`border-t border-slate-100 transition ${
                    isAdmin ? 'hover:bg-sky-50/40' : 'cursor-pointer hover:bg-sky-50/60'
                  }`}
                  role={isAdmin ? undefined : 'button'}
                  tabIndex={isAdmin ? undefined : 0}
                  onKeyDown={
                    isAdmin
                      ? undefined
                      : (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDetail(c);
                          }
                        }
                  }
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      <CreditCard size={10} /> {c.provider}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap max-w-[200px] truncate" title={c.name}>
                    {c.name}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap font-mono">
                    {formatBusinessNumber(c.businessNumber)}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap font-mono">
                    {formatBusinessNumber(c.accountNumber)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      c.active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openToggle(c); }}
                          className={`rounded-md p-1 ${c.active ? 'text-emerald-600 hover:bg-amber-50 hover:text-amber-600' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                          title={c.active ? 'Deactivate' : 'Activate'}
                        >
                          <Power size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditGate(c); }}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openDelete(c); }}
                          className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────── DIRECTOR: DETAIL VIEW ─────────── */}
      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="Payment Channel Details"
        width="max-w-md"
      >
        {detailTarget && (
          <div className="space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-sky-50 grid place-items-center ring-4 ring-sky-100">
              <CreditCard className="text-sky-600" size={26} />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-slate-800">{detailTarget.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{detailTarget.provider}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-2">
              <div className="flex justify-between items-center gap-3">
                <span className="text-slate-500 shrink-0">Business Number</span>
                <span className="font-mono font-bold text-slate-900 text-lg tracking-wide text-right break-all">
                  {formatBusinessNumber(detailTarget.businessNumber)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-slate-500 shrink-0">Account Number</span>
                <span className="font-mono font-bold text-slate-900 text-lg tracking-wide text-right break-all">
                  {formatBusinessNumber(detailTarget.accountNumber)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-500">Status</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  detailTarget.active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {detailTarget.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {detailTarget.createdByName && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Created by</span>
                  <span className="font-semibold text-slate-800">{detailTarget.createdByName}</span>
                </div>
              )}
              {detailTarget.createdAt && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Created</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(detailTarget.createdAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button className="btn-primary" onClick={() => setDetailTarget(null)}>
                <Eye size={14} /> Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────── ADMIN: CREATE ─────────── */}
      {isAdmin && (
        <>
          <Modal open={createOpen} onClose={() => !saving && setCreateOpen(false)} title="Add Payment Channel">
            <div className="space-y-3">
              <FormFields value={form} onChange={setForm} mode="create" />
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button>
                <button className="btn-primary" onClick={proceedCreate} disabled={saving}>
                  <Save size={14} /> Continue
                </button>
              </div>
            </div>
          </Modal>

          <Modal
            open={createConfirmOpen}
            onClose={() => !saving && setCreateConfirmOpen(false)}
            title="Confirm New Channel"
            width="max-w-md"
          >
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
                <CreditCard className="text-sky-600" size={22} />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-700">
                  Create a new <span className="font-semibold">{form.provider}</span> channel?
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-semibold text-slate-800">{form.name || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Business No.</span><span className="font-mono font-semibold text-slate-800">{formatBusinessNumber(form.businessNumber)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Account No.</span><span className="font-mono font-semibold text-slate-800">{formatBusinessNumber(form.accountNumber)}</span></div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn-ghost" onClick={() => setCreateConfirmOpen(false)} disabled={saving}>Back</button>
                <button className="btn-primary" onClick={confirmCreate} disabled={saving}>
                  {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><CheckCircle2 size={14} /> Create</>}
                </button>
              </div>
            </div>
          </Modal>

          {/* ─────────── ADMIN: EDIT GATE ─────────── */}
          <Modal
            open={!!editGateTarget}
            onClose={() => setEditGateTarget(null)}
            title="Edit Payment Channel"
            width="max-w-md"
          >
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
                <Pencil className="text-sky-600" size={22} />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-700">
                  Edit <span className="font-semibold">{editGateTarget?.name}</span>?
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  You'll be able to change the name, business number, account number, and status.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Provider</span>
                  <span className="font-semibold text-slate-800">{editGateTarget?.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Business No.</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatBusinessNumber(editGateTarget?.businessNumber)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account No.</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatBusinessNumber(editGateTarget?.accountNumber)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Status</span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    editGateTarget?.active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    {editGateTarget?.active ? 'Active' : 'Inactive'}
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

          {/* ─────────── ADMIN: EDIT FORM ─────────── */}
          <Modal open={!!editTarget} onClose={() => !saving && setEditTarget(null)} title="Edit Payment Channel">
            <div className="space-y-3">
              <FormFields value={editForm} onChange={setEditForm} mode="edit" />
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-ghost" onClick={() => setEditTarget(null)} disabled={saving}>Cancel</button>
                <button className="btn-primary" onClick={proceedEdit} disabled={saving}>
                  <Save size={14} /> Continue
                </button>
              </div>
            </div>
          </Modal>

          {/* ─────────── ADMIN: EDIT CONFIRM ─────────── */}
          <Modal
            open={!!editConfirmOpen}
            onClose={() => !saving && setEditConfirmOpen(false)}
            title="Confirm Changes"
            width="max-w-md"
          >
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 grid place-items-center">
                <ShieldAlert className="text-amber-600" size={22} />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-700">
                  Save changes to <span className="font-semibold">{editForm.name}</span>?
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Provider</span><span className="font-semibold text-slate-800">{editForm.provider}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-semibold text-slate-800">{editForm.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Business No.</span><span className="font-mono font-semibold text-slate-800">{formatBusinessNumber(editForm.businessNumber)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Account No.</span><span className="font-mono font-semibold text-slate-800">{formatBusinessNumber(editForm.accountNumber)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-semibold text-slate-800">{editForm.active ? 'Active' : 'Inactive'}</span></div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn-ghost" onClick={() => setEditConfirmOpen(false)} disabled={saving}>Back</button>
                <button className="btn-primary" onClick={confirmEdit} disabled={saving}>
                  {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><CheckCircle2 size={14} /> Save Changes</>}
                </button>
              </div>
            </div>
          </Modal>

          {/* ─────────── ADMIN: TOGGLE ─────────── */}
          <Modal
            open={!!toggleTarget}
            onClose={() => !saving && setToggleTarget(null)}
            title={toggleTarget?.active ? 'Deactivate Channel' : 'Activate Channel'}
            width="max-w-md"
          >
            <div className="space-y-4">
              <div className={`mx-auto h-12 w-12 rounded-full grid place-items-center ${toggleTarget?.active ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <Power size={22} className={toggleTarget?.active ? 'text-amber-600' : 'text-emerald-600'} />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-700">
                  {toggleTarget?.active ? 'Deactivate' : 'Activate'}{' '}
                  <span className="font-semibold">{toggleTarget?.name}</span>?
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {toggleTarget?.active
                    ? 'It will no longer appear as a payment option.'
                    : 'It will start appearing as a payment option.'}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setToggleTarget(null)} disabled={saving}>Cancel</button>
                <button className="btn-primary" onClick={confirmToggle} disabled={saving}>
                  {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><CheckCircle2 size={14} /> {toggleTarget?.active ? 'Deactivate' : 'Activate'}</>}
                </button>
              </div>
            </div>
          </Modal>

          {/* ─────────── ADMIN: DELETE ─────────── */}
          <Modal
            open={!!deleteTarget}
            onClose={() => !saving && setDeleteTarget(null)}
            title="Delete Payment Channel"
            width="max-w-md"
          >
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center">
                <AlertTriangle className="text-rose-500" size={22} />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-700">Delete <span className="font-semibold">{deleteTarget?.name}</span>?</p>
                <p className="text-xs text-rose-600 font-semibold mt-1">This cannot be undone.</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-semibold text-slate-800">{deleteTarget?.name || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Business No.</span><span className="font-mono font-semibold text-slate-800">{formatBusinessNumber(deleteTarget?.businessNumber)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Account No.</span><span className="font-mono font-semibold text-slate-800">{formatBusinessNumber(deleteTarget?.accountNumber)}</span></div>
              </div>
              <div>
                <label className="label">
                  Type <span className="font-mono font-bold text-rose-600">{DELETE_WORD}</span> to confirm
                </label>
                <input
                  className="input font-mono"
                  placeholder={DELETE_WORD}
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</button>
                <button
                  className="btn-danger"
                  onClick={runDelete}
                  disabled={deleteText !== DELETE_WORD || saving}
                >
                  {saving ? <span className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-600 animate-spin" /> : <><Trash2 size={14} /> Delete</>}
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Success"
        message={successMsg}
      />
    </div>
  );
};

export default PaymentChannels;