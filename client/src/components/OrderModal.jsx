import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Send, Mail, ShieldCheck, Eye, ArrowLeft, UserCog, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal.jsx';
import StyleSelect from './StyleSelect.jsx';
import api from '../lib/api.js';

const money = (n) =>
  `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

const KeyValue = ({ label, value, accent }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs font-medium text-slate-500 shrink-0">{label}</span>
    <span className={`text-sm font-semibold text-right ${accent || 'text-slate-800'}`}>{value}</span>
  </div>
);

const GridCell = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{label}</p>
    <p className="text-xs text-slate-800 font-semibold break-words">{value || '-'}</p>
  </div>
);

const OrderModal = ({ open, onClose, patient, onSuccess, emailMode = 'full' }) => {
  // ─── ALL HOOKS FIRST ───
  const [mode, setMode] = useState('default');
  const [recipients, setRecipients] = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsError, setRecipientsError] = useState(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [sending, setSending] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setSelectedRecipientId('');
    setRecipientsError(null);
    setRecipientsLoading(true);

    api
      .get('/custom-recipients', { params: { active: 'true' } })
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : [];
        if (alive) {
          setRecipients(data);
          setRecipientsError(null);
        }
      })
      .catch((e) => {
        if (alive) {
          setRecipients([]);
          setRecipientsError(
            e?.response?.data?.message || e?.message || 'Failed to load recipients'
          );
        }
      })
      .finally(() => {
        if (alive) setRecipientsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open]);

  const recipientOptions = useMemo(
    () =>
      (Array.isArray(recipients) ? recipients : []).map((r) => ({
        value: r._id,
        label: r.email,
      })),
    [recipients]
  );

  if (!patient) return null;

  const total = (patient.lensAmount || 0) + (patient.frameAmount || 0);
  const diagnosesText =
    patient.diagnoses?.length > 0
      ? patient.diagnoses
          .map((d, i) => {
            const parts = [d.code, d.description].filter(Boolean);
            return `${i + 1}. ${parts.join(' - ')}`;
          })
          .join(', ')
      : '-';

  const submit = async () => {
    let recipientEmail;
    if (mode === 'custom') {
      const picked = recipients.find((r) => r._id === selectedRecipientId);
      if (!picked) {
        toast.error('Select a custom recipient');
        return;
      }
      recipientEmail = picked.email;
    }
    setSending(true);
    try {
      await api.post(`/patients/${patient._id}/order`, {
        sendToDefault: mode === 'default',
        recipientEmail: mode === 'custom' ? recipientEmail : undefined,
        emailMode,
      });
      toast.success('Order submitted & email sent');
      onSuccess?.();
      onClose();
      setShowDetails(false);
      setSelectedRecipientId('');
      setMode('default');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit order');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setShowDetails(false);
    onClose();
  };

  return (
    <>
      <Modal open={open && !showDetails} onClose={handleClose} title="Confirm Order">
        <div className="rounded-xl bg-slate-50 p-3 mb-3">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
            <span className="text-[11px] uppercase tracking-wide font-bold text-slate-400">
              Email format
            </span>
            <span className={`badge ${emailMode === 'mini' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'}`}>
              {emailMode === 'mini' ? 'Mini Summary' : 'Full Summary'}
            </span>
          </div>

          <KeyValue label="Patient" value={patient.name} />
          <KeyValue
            label="Scheme"
            value={
              patient.scheme === 'Insurance' && patient.insurance
                ? `Insurance - ${patient.insurance}`
                : (patient.scheme || '-')
            }
          />
          <KeyValue label="Lens Type" value={patient.lensType} />
          <KeyValue label="Frame Code" value={patient.frameCode || '-'} />
          <KeyValue label="Total" value={money(total)} accent="text-sky-600 text-base" />
        </div>

        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition mb-3"
        >
          <span className="flex items-center gap-2">
            <Eye size={14} /> Show full order summary
          </span>
          <span className="text-[10px] text-slate-400">opens in a separate view</span>
        </button>

        <div className="mb-3">
          <p className="label">Send order email to</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('default')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                mode === 'default'
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <ShieldCheck size={15} /> Configured Mail
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                mode === 'custom'
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Mail size={15} /> Custom Mail
            </button>
          </div>
        </div>

        {mode === 'custom' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3"
          >
            <label className="label">Recipient</label>
            <StyleSelect
              value={selectedRecipientId}
              onChange={setSelectedRecipientId}
              options={recipientOptions}
              placeholder={
                recipientsLoading
                  ? 'Loading recipients…'
                  : recipientsError
                  ? 'Failed to load - try reopening'
                  : recipientOptions.length === 0
                  ? 'No recipients configured'
                  : 'Select recipient…'
              }
              icon={UserCog}
              openUp
            />
            {recipientOptions.length === 0 && !recipientsLoading && (
              <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                <AlertCircle size={11} />
                {recipientsError
                  ? recipientsError
                  : 'Open Recipients in the sidebar to add custom mail recipients.'}
              </p>
            )}
          </motion.div>
        )}

        <div className="flex gap-2 justify-end">
          <button className="btn-ghost" onClick={handleClose} disabled={sending}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={sending || (mode === 'custom' && !selectedRecipientId)}
          >
            {sending ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send size={15} /> Submit Order
              </>
            )}
          </button>
        </div>
      </Modal>

      <Modal
        open={open && showDetails}
        onClose={() => setShowDetails(false)}
        title="Full Order Summary"
        width="max-w-xl"
      >
        <div className="rounded-xl bg-slate-50 p-3 mb-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <GridCell label="Patient" value={patient.name} />
            <GridCell label="System No." value={patient.systemNumber} />
            <GridCell label="Scheme" value={patient.scheme} />
            <GridCell
              label="Insurance"
              value={patient.scheme === 'Insurance' ? patient.insurance || '-' : '-'}
            />
            <GridCell label="Lens Type" value={patient.lensType} />
            <GridCell label="Frame Code" value={patient.frameCode} />
            <GridCell label="RX BE" value={patient.rxBe} />
            <GridCell label="ADD" value={patient.rxAdd} />
            <GridCell label="PD" value={patient.rxPd} />
            <GridCell label="Lens Amount" value={money(patient.lensAmount)} />
            <GridCell label="Frame Amount" value={money(patient.frameAmount)} />
            <GridCell label="Total" value={money(total)} />
            <div className="col-span-2">
              <GridCell label="Diagnoses" value={diagnosesText} />
            </div>
            <div className="col-span-2">
              <GridCell label="Complaint" value={patient.complaint || '-'} />
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <button className="btn-ghost" onClick={() => setShowDetails(false)}>
            <ArrowLeft size={14} /> Back
          </button>
          <button className="btn-primary" onClick={submit} disabled={sending}>
            {sending ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send size={15} /> Submit Order
              </>
            )}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default OrderModal;