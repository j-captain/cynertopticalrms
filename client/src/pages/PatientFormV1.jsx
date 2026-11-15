import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, ArrowLeft, Plus, X, CalendarCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import DiagnosisPicker from '../components/DiagnosisPicker.jsx';
import InsuranceSelect from '../components/InsuranceSelect.jsx';

const initial = {
  name: '',
  systemNumber: '',
  lensType: '',
  rxBe: '',
  rxAdd: '',
  rxPd: '',
  lensAmount: '',
  frameCode: '',
  frameAmount: '',
  preAuthDate: '',
  complaint: '',
  scheme: '',
  insurance: '',
};

const MAX_DIAGNOSES = 5;
const emptyDx = { code: '', description: '' };

const PatientForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(initial);
  const [diagnoses, setDiagnoses] = useState([{ ...emptyDx }]);
  const [submissionDate, setSubmissionDate] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/patients/${id}`).then((r) => {
      const p = r.data;
      setForm({
        name: p.name || '',
        systemNumber: p.systemNumber || '',
        lensType: p.lensType || '',
        rxBe: p.rxBe || '',
        rxAdd: p.rxAdd || '',
        rxPd: p.rxPd || '',
        lensAmount: p.lensAmount ?? '',
        frameCode: p.frameCode || '',
        frameAmount: p.frameAmount ?? '',
        preAuthDate: p.preAuthDate ? p.preAuthDate.slice(0, 10) : '',
        complaint: p.complaint || '',
        scheme: p.scheme || '',
        insurance: p.insurance || '',
      });
      const dx = Array.isArray(p.diagnoses) && p.diagnoses.length
        ? p.diagnoses.map((d) => ({ code: d.code || '', description: d.description || '' }))
        : [{ ...emptyDx }];
      setDiagnoses(dx.slice(0, MAX_DIAGNOSES));
      setSubmissionDate(p.submissionDate || null);
      setOrderPlaced(Boolean(p.orderPlaced));
    });
  }, [id, isEdit]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const setDiagnosis = (i, val) =>
    setDiagnoses((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });

  const addDiagnosis = () => {
    if (diagnoses.length >= MAX_DIAGNOSES) return;
    setDiagnoses((prev) => [...prev, { ...emptyDx }]);
  };

  const removeDiagnosis = (i) => {
    if (i === 0) return;
    setDiagnoses((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!form.scheme) return toast.error('Select a scheme');
    if (form.scheme === 'Insurance' && !form.insurance) {
      return toast.error('Select an insurance');
    }

    const cleanDx = diagnoses
      .map((d) => ({ code: (d.code || '').trim(), description: (d.description || '').trim() }))
      .filter((d) => d.code.length > 0 || d.description.length > 0);
    if (cleanDx.length === 0) return toast.error('Diagnosis 1 is required');
    if (!form.complaint.trim()) return toast.error('Complaint is required');

    setSaving(true);
    try {
      const payload = {
        ...form,
        lensAmount: Number(form.lensAmount) || 0,
        frameAmount: Number(form.frameAmount) || 0,
        preAuthDate: form.preAuthDate || undefined,
        diagnoses: cleanDx,
        complaint: form.complaint.trim(),
        insurance: form.scheme === 'Insurance' ? form.insurance : '',
      };
      if (isEdit) {
        await api.put(`/patients/${id}`, payload);
        toast.success('Record updated');
      } else {
        await api.post('/patients', payload);
        toast.success('Record created');
      }
      navigate('/patients');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const total = (Number(form.lensAmount) || 0) + (Number(form.frameAmount) || 0);

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate(-1)} className="btn-ghost !px-3 mb-4">
        <ArrowLeft size={16} /> Back
      </button>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
        <h1 className="text-xl font-extrabold text-slate-900 mb-1">
          {isEdit ? 'Edit Patient Record' : 'New Patient Record'}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          All fields are required except ADD.
        </p>

        {isEdit && (orderPlaced || submissionDate) && (
          <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-3 mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <CalendarCheck size={16} className="text-emerald-700" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-emerald-800">
                {orderPlaced ? 'Order Submitted' : 'Submitted'}
              </p>
              <p className="text-xs text-emerald-700/80">
                Submission date: <span className="font-semibold">{submissionDate ? fmtDate(submissionDate) : '-'}</span>
                {' · '}Submission date is managed from the Patients table.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Patient Name <span className="text-rose-500">*</span></label>
              <input className="input" name="name" value={form.name} onChange={onChange} required />
            </div>
            <div>
              <label className="label">System Number <span className="text-rose-500">*</span></label>
              <input className="input" name="systemNumber" value={form.systemNumber} onChange={onChange} required />
            </div>
            <div>
              <label className="label">Lens Type <span className="text-rose-500">*</span></label>
              <input className="input" name="lensType" value={form.lensType} onChange={onChange} required />
            </div>
            <div>
              <label className="label">Lens Amount (KES) <span className="text-rose-500">*</span></label>
              <input className="input" type="number" min="0" step="0.01" name="lensAmount" value={form.lensAmount} onChange={onChange} required />
            </div>
            <div>
              <label className="label">Frame Code <span className="text-rose-500">*</span></label>
              <input className="input" name="frameCode" value={form.frameCode} onChange={onChange} required />
            </div>
            <div>
              <label className="label">Frame Amount (KES) <span className="text-rose-500">*</span></label>
              <input className="input" type="number" min="0" step="0.01" name="frameAmount" value={form.frameAmount} onChange={onChange} required />
            </div>
            <div>
              <label className="label">Pre-Auth Date <span className="text-rose-500">*</span></label>
              <input className="input" type="date" name="preAuthDate" value={form.preAuthDate} onChange={onChange} required />
            </div>
            <div>
              <label className="label">Total (auto)</label>
              <div className="input !bg-slate-50 !text-slate-700 font-semibold">
                KES {total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Scheme + Insurance */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Billing
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <InsuranceSelect
                scheme={form.scheme}
                insurance={form.insurance}
                onChange={({ scheme, insurance }) => setForm((f) => ({ ...f, scheme, insurance }))}
              />
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Prescription
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="label">RX BE <span className="text-rose-500">*</span></label>
                <input className="input" name="rxBe" value={form.rxBe} onChange={onChange} placeholder="e.g. -1.25" required />
              </div>
              <div>
                <label className="label">ADD</label>
                <input className="input" name="rxAdd" value={form.rxAdd} onChange={onChange} placeholder="e.g. +2.00" />
              </div>
              <div>
                <label className="label">PD <span className="text-rose-500">*</span></label>
                <input className="input" name="rxPd" value={form.rxPd} onChange={onChange} placeholder="e.g. 63" required />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Diagnoses ({diagnoses.length}/{MAX_DIAGNOSES})
              </p>
              {diagnoses.length < MAX_DIAGNOSES && (
                <button
                  type="button"
                  onClick={addDiagnosis}
                  className="inline-flex items-center gap-1 rounded-md bg-sky-50 text-sky-700 border border-sky-100 px-2.5 py-1 text-[11px] font-semibold hover:bg-sky-100 transition"
                >
                  <Plus size={12} /> Add Diagnosis
                </button>
              )}
            </div>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {diagnoses.map((d, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="w-24 shrink-0 text-xs font-semibold text-slate-500">
                      Diagnosis {i + 1} {i === 0 && <span className="text-rose-500">*</span>}
                    </span>
                    <DiagnosisPicker
                      value={d}
                      onChange={(val) => setDiagnosis(i, val)}
                      required={i === 0}
                    />
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => removeDiagnosis(i)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div>
            <label className="label">Complaint <span className="text-rose-500">*</span></label>
            <textarea
              className="input"
              rows="3"
              name="complaint"
              value={form.complaint}
              onChange={onChange}
              required
              placeholder="Patient's presenting complaint…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Save size={16} /> {isEdit ? 'Update' : 'Create'}</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default PatientForm;