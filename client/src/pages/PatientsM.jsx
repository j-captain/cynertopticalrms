import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, Pencil, Trash2, Send, Filter, CheckCheck, Truck,
  CalendarCheck, AlertTriangle, CheckCircle2, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import OrderModal from '../components/OrderModal.jsx';
import EmailModeModal from '../components/EmailModeModal.jsx';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import DocumentationModal from '../components/DocumentationModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const StatusDot = ({ ok, label }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
    <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
    <span className={ok ? 'text-emerald-700' : 'text-slate-400'}>{label}</span>
  </span>
);

const formatDiagnoses = (diagnoses) => {
  if (!diagnoses || !diagnoses.length) return '-';
  return diagnoses
    .map((d, i) => {
      const parts = [d.code, d.description].filter(Boolean);
      return `${i + 1}. ${parts.join(' - ')}`;
    })
    .join(', ');
};

const Patients = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  // Order
  const [orderOpen, setOrderOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [resubmitTarget, setResubmitTarget] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Email mode
  const [emailModeOpen, setEmailModeOpen] = useState(false);
  const [emailModeTarget, setEmailModeTarget] = useState(null);
  const [emailMode, setEmailMode] = useState('full');

  // Mark as submitted
  const [markOpen, setMarkOpen] = useState(false);
  const [markTarget, setMarkTarget] = useState(null);
  const [markDate, setMarkDate] = useState('');
  const [markConfirmOpen, setMarkConfirmOpen] = useState(false);
  const [markSaving, setMarkSaving] = useState(false);

  // Deliver / Hand
  const [statusAction, setStatusAction] = useState(null);
  const [statusWorking, setStatusWorking] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteText, setDeleteText] = useState('');
  const [deleteWorking, setDeleteWorking] = useState(false);

  // Edit
  const [editTarget, setEditTarget] = useState(null);

  // Documents
  const [docTarget, setDocTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/patients', { params: { q, status } });
      setPatients(r.data);
    } catch {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const handleSubmitClick = (p) => {
    if (p.orderPlaced) {
      setResubmitTarget(p);
      setResubmitOpen(true);
    } else {
      setEmailModeTarget(p);
      setEmailModeOpen(true);
    }
  };

  const confirmResubmit = () => {
    setEmailModeTarget(resubmitTarget);
    setResubmitOpen(false);
    setEmailModeOpen(true);
  };

  const onEmailModeSelect = (m) => {
    setEmailMode(m);
    setSelected(emailModeTarget);
    setEmailModeOpen(false);
    setOrderOpen(true);
  };

  const onOrderSuccess = () => {
    load();
    const wasResubmit = Boolean(selected?.orderPlaced);
    const label = emailMode === 'mini' ? 'Mini' : 'Full';
    setSuccessMsg(
      wasResubmit
        ? `Order email resent successfully (${label} summary).`
        : `Order submitted and email sent (${label} summary).`
    );
    setSuccessOpen(true);
  };

  const openMarkModal = (p) => {
    setMarkTarget(p);
    setMarkDate(p.submissionDate ? new Date(p.submissionDate).toISOString().slice(0, 10) : '');
    setMarkOpen(true);
  };

  const proceedMark = () => {
    if (!markDate) return toast.error('Pick a submission date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(markDate)) return toast.error('Invalid date format');
    setMarkConfirmOpen(true);
  };

  const confirmMark = async () => {
    setMarkSaving(true);
    try {
      await api.post(`/patients/${markTarget._id}/mark-submitted`, { submissionDate: markDate });
      setMarkConfirmOpen(false);
      setMarkOpen(false);
      setSuccessMsg(`Order marked as submitted on ${fmtDate(markDate)}.`);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to mark as submitted');
    } finally {
      setMarkSaving(false);
    }
  };

  const openStatusConfirm = (target, field) => {
    setStatusAction({ target, field });
  };

  const runStatusUpdate = async () => {
    if (!statusAction) return;
    setStatusWorking(true);
    const { target, field } = statusAction;
    try {
      await api.patch(`/patients/${target._id}/status`, { field, value: true });
      const label = field === 'orderDelivered' ? 'Delivered' : 'Handed to Client';
      setSuccessMsg(`${target.name} marked as ${label}.`);
      setStatusAction(null);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setStatusWorking(false);
    }
  };

  const openDeleteConfirm = (target) => {
    setDeleteTarget(target);
    setDeleteText('');
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setDeleteWorking(true);
    try {
      await api.delete(`/patients/${deleteTarget._id}`);
      setSuccessMsg(`Record for ${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteWorking(false);
    }
  };

  const counts = useMemo(() => ({ shown: patients.length }), [patients]);
  const DELETE_WORD = 'DELETE';

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Patient Records</h1>
          <p className="text-xs text-slate-500 mt-0.5">{counts.shown} record(s)</p>
        </div>
        <button className="btn-primary !py-1.5 !px-3 !text-xs" onClick={() => navigate('/patients/new')}>
          <Plus size={14} /> New Record
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-2 !pl-8 !text-xs"
            placeholder="Search name, system no., frame code, scheme, insurance, or diagnosis…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            className="input !py-2 !pl-8 !pr-7 !text-xs md:w-44 appearance-none"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending Order</option>
            <option value="ordered">Ordered</option>
            <option value="delivered">Delivered</option>
            <option value="handed">Handed to Client</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">Patient</th>
                <th className="px-2 py-2 text-left font-semibold">Sys No.</th>
                <th className="px-2 py-2 text-left font-semibold">Scheme</th>
                <th className="px-2 py-2 text-left font-semibold">Insurance</th>
                <th className="px-2 py-2 text-left font-semibold">Lens</th>
                <th className="px-2 py-2 text-left font-semibold">RX BE</th>
                <th className="px-2 py-2 text-left font-semibold">ADD</th>
                <th className="px-2 py-2 text-left font-semibold">PD</th>
                <th className="px-2 py-2 text-left font-semibold">Diagnoses</th>
                <th className="px-2 py-2 text-left font-semibold">Complaint</th>
                <th className="px-2 py-2 text-right font-semibold">Lens ₹</th>
                <th className="px-2 py-2 text-left font-semibold">Frame</th>
                <th className="px-2 py-2 text-right font-semibold">Frm ₹</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="px-2 py-2 text-left font-semibold">Pre-Auth</th>
                <th className="px-2 py-2 text-left font-semibold">Submitted</th>
                <th className="px-2 py-2 text-left font-semibold">Order</th>
                <th className="px-2 py-2 text-left font-semibold">Deliv.</th>
                <th className="px-2 py-2 text-left font-semibold">Handed</th>
                <th className="px-2 py-2 text-left font-semibold">Docs</th>
                <th className="px-2 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={22} className="text-center py-8 text-slate-400 text-xs">Loading…</td></tr>
              )}
              {!loading && patients.length === 0 && (
                <tr><td colSpan={22} className="text-center py-8 text-slate-400 text-xs">No records found.</td></tr>
              )}
              {patients.map((p, i) => (
                <motion.tr
                  key={p._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.15) }}
                  className="border-t border-slate-100 hover:bg-sky-50/40 transition"
                >
                  <td className="px-2 py-1.5 text-slate-400 tabular-nums">{p.index}</td>
                  <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap max-w-[140px] truncate">{p.name}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.systemNumber}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={`badge ${p.scheme === 'Insurance' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {p.scheme === 'Insurance' ? 'Insurance' : 'Cash'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[140px] truncate" title={p.insurance || ''}>
                    {p.scheme === 'Insurance' ? (p.insurance || '-') : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{p.lensType}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.rxBe || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.rxAdd || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.rxPd || '-'}</td>
                  <td
                    className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate"
                    title={p.diagnoses?.map((d) => `${d.code} ${d.description}`).join(', ') || ''}
                  >
                    {formatDiagnoses(p.diagnoses)}
                  </td>
                  <td
                    className="px-2 py-1.5 text-slate-600 max-w-[160px] truncate"
                    title={p.complaint || ''}
                  >
                    {p.complaint || '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-700 whitespace-nowrap tabular-nums">{money(p.lensAmount)}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.frameCode || '-'}</td>
                  <td className="px-2 py-1.5 text-right text-slate-700 whitespace-nowrap tabular-nums">{money(p.frameAmount)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-sky-600 whitespace-nowrap tabular-nums">{money(p.totalAmount)}</td>
                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(p.preAuthDate)}</td>
                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(p.submissionDate)}</td>
                  <td className="px-2 py-1.5"><StatusDot ok={p.orderPlaced} label={p.orderPlaced ? 'Ordered' : 'Pending'} /></td>
                  <td className="px-2 py-1.5"><StatusDot ok={p.orderDelivered} label={p.orderDelivered ? 'Yes' : 'No'} /></td>
                  <td className="px-2 py-1.5"><StatusDot ok={p.orderHandedToClient} label={p.orderHandedToClient ? 'Yes' : 'No'} /></td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => setDocTarget(p)}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 px-2 py-1 text-[10px] font-semibold hover:bg-slate-100 transition"
                      title="Manage documentation"
                    >
                      <FileText size={10} />
                      {p.documents?.length ? `${p.documents.length}/2` : 'None'}
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleSubmitClick(p)}
                        className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-2 py-1 text-[10px] font-semibold hover:shadow-md hover:-translate-y-0.5 transition"
                        title={p.orderPlaced ? 'Resubmit' : 'Submit'}
                      >
                        <Send size={10} /> {p.orderPlaced ? 'Resubmit' : 'Submit'}
                      </button>
                      <button
                        onClick={() => openMarkModal(p)}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 text-[10px] font-semibold hover:bg-amber-100 transition"
                        title={p.orderPlaced ? 'Update submission date' : 'Mark as Submitted'}
                      >
                        <CalendarCheck size={10} /> {p.orderPlaced ? 'Edit Date' : 'Mark'}
                      </button>
                      {p.orderPlaced && !p.orderDelivered && (
                        <button
                          onClick={() => openStatusConfirm(p, 'orderDelivered')}
                          className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-600 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 transition"
                          title="Mark delivered"
                        >
                          <Truck size={10} /> Deliver
                        </button>
                      )}
                      {p.orderDelivered && !p.orderHandedToClient && (
                        <button
                          onClick={() => openStatusConfirm(p, 'orderHandedToClient')}
                          className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-600 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 transition"
                          title="Mark handed"
                        >
                          <CheckCheck size={10} /> Hand
                        </button>
                      )}
                      <button
                        onClick={() => setEditTarget(p)}
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit"
                      >
                        <Pencil size={12} />
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => openDeleteConfirm(p)}
                          className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Mode picker (before OrderModal) */}
      <EmailModeModal
        open={emailModeOpen}
        onClose={() => setEmailModeOpen(false)}
        onSelect={onEmailModeSelect}
      />

      {/* Order submit */}
      <OrderModal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        patient={selected}
        onSuccess={onOrderSuccess}
        emailMode={emailMode}
      />

      {/* Resubmit confirm */}
      <Modal open={resubmitOpen} onClose={() => setResubmitOpen(false)} title="Already Submitted" width="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This order has already been submitted on{' '}
            <span className="font-semibold text-slate-800">
              {resubmitTarget?.submissionDate ? fmtDate(resubmitTarget.submissionDate) : 'an earlier date'}
            </span>
            . Resubmitting will send the email again and update the submission date to today.
          </p>
          <p className="text-xs text-slate-400">Do you wish to resubmit?</p>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setResubmitOpen(false)}>No</button>
            <button className="btn-primary" onClick={confirmResubmit}>
              <Send size={14} /> Resubmit
            </button>
          </div>
        </div>
      </Modal>

      {/* Mark as submitted */}
      <Modal
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        title={markTarget?.orderPlaced ? 'Update Submission Date' : 'Mark as Submitted'}
        width="max-w-md"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {markTarget?.orderPlaced ? (
              <>Update the submission date for <span className="font-semibold">{markTarget?.name}</span> ({markTarget?.systemNumber}). No email will be sent.</>
            ) : (
              <>Mark <span className="font-semibold">{markTarget?.name}</span> ({markTarget?.systemNumber}) as submitted without sending an email. Pick the date the order was placed.</>
            )}
          </p>
          <div>
            <label className="label">Submission Date</label>
            <input
              type="date"
              className="input"
              value={markDate}
              onChange={(e) => setMarkDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {markDate ? <>Will be saved as <span className="font-semibold text-slate-700">{fmtDate(markDate)}</span></> : 'Pick a date to continue'}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setMarkOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={proceedMark} disabled={!markDate}>
              <CalendarCheck size={14} /> Continue
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={markConfirmOpen}
        onClose={() => setMarkConfirmOpen(false)}
        title={markTarget?.orderPlaced ? 'Confirm Date Update' : 'Confirm Submission'}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-500">Patient</span><span className="font-semibold text-slate-800">{markTarget?.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">System No.</span><span className="font-semibold text-slate-800">{markTarget?.systemNumber}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-semibold text-sky-600">{money(markTarget?.totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Submission Date</span><span className="font-semibold text-slate-800">{markDate ? fmtDate(markDate) : '-'}</span></div>
          </div>
          <p className="text-xs text-slate-500">No email will be sent. The order will be recorded as submitted with this exact date.</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setMarkConfirmOpen(false)} disabled={markSaving}>Back</button>
            <button className="btn-primary" onClick={confirmMark} disabled={markSaving}>
              {markSaving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><CheckCircle2 size={14} /> Confirm</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Deliver / Hand confirm */}
      <Modal
        open={!!statusAction}
        onClose={() => !statusWorking && setStatusAction(null)}
        title={statusAction?.field === 'orderDelivered' ? 'Mark as Delivered' : 'Mark as Handed'}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            {statusAction?.field === 'orderDelivered' ? (
              <Truck className="text-sky-600" size={22} />
            ) : (
              <CheckCheck className="text-sky-600" size={22} />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              {statusAction?.field === 'orderDelivered' ? (
                <>Mark <span className="font-semibold">{statusAction?.target?.name}</span> as <span className="font-semibold text-sky-600">Delivered</span>?</>
              ) : (
                <>Mark <span className="font-semibold">{statusAction?.target?.name}</span> as <span className="font-semibold text-emerald-600">Handed to Client</span>?</>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {statusAction?.field === 'orderDelivered'
                ? 'This confirms the lenses/frame have been received from the lab.'
                : 'This confirms the order has been physically handed to the patient.'}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between"><span>Patient</span><span className="font-semibold text-slate-800">{statusAction?.target?.name}</span></div>
            <div className="flex justify-between"><span>System No.</span><span className="font-mono font-semibold text-slate-800">{statusAction?.target?.systemNumber}</span></div>
            <div className="flex justify-between"><span>Total</span><span className="font-semibold text-sky-600">{money(statusAction?.target?.totalAmount)}</span></div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setStatusAction(null)} disabled={statusWorking}>
              Cancel
            </button>
            <button className="btn-primary" onClick={runStatusUpdate} disabled={statusWorking}>
              {statusWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><CheckCircle2 size={14} /> Confirm</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleteWorking && setDeleteTarget(null)}
        title="Delete Record"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center">
            <AlertTriangle className="text-rose-500" size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Delete the record for <span className="font-semibold">{deleteTarget?.name}</span>?
            </p>
            <p className="text-xs text-rose-600 font-semibold mt-1">
              This cannot be undone.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between"><span>Patient</span><span className="font-semibold text-slate-800">{deleteTarget?.name}</span></div>
            <div className="flex justify-between"><span>System No.</span><span className="font-mono font-semibold text-slate-800">{deleteTarget?.systemNumber}</span></div>
            <div className="flex justify-between"><span>Total</span><span className="font-semibold text-sky-600">{money(deleteTarget?.totalAmount)}</span></div>
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
            <button className="btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleteWorking}>
              Cancel
            </button>
            <button
              className="btn-danger"
              onClick={runDelete}
              disabled={deleteText !== DELETE_WORD || deleteWorking}
            >
              {deleteWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-600 animate-spin" />
              ) : (
                <><Trash2 size={14} /> Delete</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit confirm */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Patient Record"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            <Pencil className="text-sky-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Open the editor for <span className="font-semibold">{editTarget?.name}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Changes you save will update this record immediately. You can cancel at any time inside the editor.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Patient</span>
              <span className="font-semibold text-slate-800">{editTarget?.name}</span>
            </div>
            <div className="flex justify-between">
              <span>System No.</span>
              <span className="font-mono font-semibold text-slate-800">{editTarget?.systemNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Scheme</span>
              <span className="font-semibold text-slate-800">
                {editTarget?.scheme === 'Insurance' ? 'Insurance' : 'Cash'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-semibold text-sky-600">{money(editTarget?.totalAmount)}</span>
            </div>
            {editTarget?.orderPlaced && (
              <div className="flex justify-between pt-1 border-t border-slate-200 mt-1">
                <span className="text-amber-700 font-semibold">Status</span>
                <span className="font-semibold text-amber-700">
                  Already ordered{editTarget?.submissionDate ? ` on ${fmtDate(editTarget.submissionDate)}` : ''}
                </span>
              </div>
            )}
          </div>

          {editTarget?.orderPlaced && (
            <p className="text-[11px] text-amber-700 flex items-start gap-1">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              This record has already been submitted. Editing will not automatically resubmit or change the submission date.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setEditTarget(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                const id = editTarget?._id;
                setEditTarget(null);
                if (id) navigate(`/patients/${id}/edit`);
              }}
            >
              <Pencil size={14} /> Open Editor
            </button>
          </div>
        </div>
      </Modal>

      {/* Documents modal */}
      <DocumentationModal
        open={!!docTarget}
        onClose={() => setDocTarget(null)}
        patient={docTarget}
        onChanged={load}
      />

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Success"
        message={successMsg}
      />
    </div>
  );
};

export default Patients;