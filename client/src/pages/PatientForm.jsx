import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, ArrowLeft, Plus, X, CalendarCheck, Glasses, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import DiagnosisPicker from '../components/DiagnosisPicker.jsx';
import InsuranceSelect from '../components/InsuranceSelect.jsx';
import StyleSelect from '../components/StyleSelect.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/* Fields a non-admin may edit. Must mirror the whitelist in
   patientController.js (NON_ADMIN_EDITABLE) - keep them in sync. */
const NON_ADMIN_EDITABLE = ['frameCode', 'scheme', 'insurance', 'lensType', 'complaint'];

/* Insurers that are effectively self-sponsored - no SHA pre-auth needed.
   Case-insensitive substring match so "University of EMBU",
   "UNIVERSITY OF EMBU", "University of Embu Ltd" all match. */
const SELF_SPONSORED_INSURERS = ['embu'];

const isSelfSponsoredInsurance = (insuranceName) => {
  if (!insuranceName) return false;
  const needle = String(insuranceName).toLowerCase();
  return SELF_SPONSORED_INSURERS.some((term) => needle.includes(term));
};

const isPreAuthNotApplicable = (scheme, insurance) =>
  scheme === 'Self-Sponsored (Cash)' ||
  (scheme === 'Insurance' && isSelfSponsoredInsurance(insurance));

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
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const isAdmin = user?.role === 'admin';

  const canEditField = (name) => isAdmin || NON_ADMIN_EDITABLE.includes(name);

  const [form, setForm] = useState(initial);
  const [diagnoses, setDiagnoses] = useState([{ ...emptyDx }]);
  const [submissionDate, setSubmissionDate] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lens types
  const [lensTypes, setLensTypes] = useState([]);
  const [lensTypesLoading, setLensTypesLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLensTypesLoading(true);
    api
      .get('/lens-types', { params: { active: 'true' } })
      .then((r) => { if (alive) setLensTypes(Array.isArray(r.data) ? r.data : []); })
      .catch(() => {})
      .finally(() => { if (alive) setLensTypesLoading(false); });
    return () => { alive = false; };
  }, []);

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

  const lensOptions = useMemo(
    () =>
      (lensTypes || []).map((l) => ({
        value: l.name,
        label: `${l.name} - KES ${Number(l.price).toLocaleString()}`,
      })),
    [lensTypes]
  );

  const handleLensChange = (name) => {
    if (!canEditField('lensType')) return;
    const picked = lensTypes.find((l) => l.name === name);
    setForm((f) => ({
      ...f,
      lensType: name,
      lensAmount: picked ? String(picked.price) : f.lensAmount,
    }));
  };

  const onChange = (e) => {
    const { name } = e.target;
    if (!canEditField(name)) return;
    setForm({ ...form, [name]: e.target.value });
  };

  const setDiagnosis = (i, val) => {
    if (!canEditField('diagnoses')) return;
    setDiagnoses((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };

  const addDiagnosis = () => {
    if (!canEditField('diagnoses')) return;
    if (diagnoses.length >= MAX_DIAGNOSES) return;
    setDiagnoses((prev) => [...prev, { ...emptyDx }]);
  };

  const removeDiagnosis = (i) => {
    if (!canEditField('diagnoses')) return;
    if (i === 0) return;
    setDiagnoses((prev) => prev.filter((_, idx) => idx !== i));
  };

  /* ─── Pre-Auth applicability (Cash OR self-sponsored insurer) ─── */
  const isCash = form.scheme === 'Self-Sponsored (Cash)';
  const isPreAuthNA = isPreAuthNotApplicable(form.scheme, form.insurance);

  const submit = async (e) => {
    e.preventDefault();

    if (!form.scheme) return toast.error('Select a scheme');
    if (form.scheme === 'Insurance' && !form.insurance) {
      return toast.error('Select an insurance');
    }
    if (!form.lensType) return toast.error('Select a lens type');

    // Pre-Auth is required only when it's applicable AND the user can
    // actually set it. Non-admins who can't edit preAuthDate shouldn't
    // be blocked by a rule they can't satisfy.
    if (
      !isPreAuthNA &&
      form.scheme === 'Insurance' &&
      !form.preAuthDate &&
      canEditField('preAuthDate')
    ) {
      return toast.error('Pre-Auth Date is required for insurance orders');
    }

    const cleanDx = diagnoses
      .map((d) => ({ code: (d.code || '').trim(), description: (d.description || '').trim() }))
      .filter((d) => d.code.length > 0 || d.description.length > 0);
    if (cleanDx.length === 0) return toast.error('Diagnosis 1 is required');
    if (!form.complaint.trim()) return toast.error('Complaint is required');

    setSaving(true);
    try {
      const basePayload = {
        ...form,
        lensAmount: Number(form.lensAmount) || 0,
        frameAmount: Number(form.frameAmount) || 0,
        // Strip pre-auth when it's N/A (Cash OR self-sponsored insurance)
        preAuthDate: isPreAuthNA ? undefined : (form.preAuthDate || undefined),
        diagnoses: cleanDx,
        complaint: form.complaint.trim(),
        insurance: form.scheme === 'Insurance' ? form.insurance : '',
      };

      // Non-admins: strip everything outside the whitelist before sending.
      let payload = basePayload;
      if (isEdit && !isAdmin) {
        payload = {};
        for (const k of NON_ADMIN_EDITABLE) {
          if (basePayload[k] !== undefined) payload[k] = basePayload[k];
        }
      }

      if (isEdit) {
        await api.put(`/patients/${id}`, payload);
        toast.success('Record updated');
      } else {
        await api.post('/patients', payload);
        toast.success('Record created');
      }
      navigate('/patients');
    } catch (err) {
      const msg = err.response?.data?.message || 'Save failed';
      if (err.response?.status === 403 && err.response?.data?.fields?.length) {
        toast.error(`Not allowed to modify: ${err.response.data.fields.join(', ')}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const total = (Number(form.lensAmount) || 0) + (Number(form.frameAmount) || 0);

  const inputDisabled = (name) =>
    !canEditField(name) ? '!bg-slate-50 !text-slate-500 cursor-not-allowed' : '';

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

        {isEdit && !isAdmin && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-5 flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2 shrink-0">
              <ShieldAlert size={16} className="text-amber-700" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Restricted editing</p>
              <p className="text-xs text-amber-700/90">
                You can only change <strong>Frame Code</strong>, <strong>Scheme</strong>, <strong>Insurance</strong>,{' '}
                <strong>Lens Type</strong>, and <strong>Complaint</strong>. Contact an admin for any other corrections.
              </p>
            </div>
          </div>
        )}

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
              <input
                className={`input ${inputDisabled('name')}`}
                name="name"
                value={form.name}
                onChange={onChange}
                disabled={!canEditField('name')}
                title={!canEditField('name') ? 'Only admins can change this field' : ''}
                required
              />
            </div>
            <div>
              <label className="label">System Number <span className="text-rose-500">*</span></label>
              <input
                className={`input font-mono ${inputDisabled('systemNumber')}`}
                name="systemNumber"
                value={form.systemNumber}
                onChange={onChange}
                disabled={!canEditField('systemNumber')}
                title={!canEditField('systemNumber') ? 'Only admins can change this field' : ''}
                required
              />
            </div>
            <div>
              <label className="label">Lens Type <span className="text-rose-500">*</span></label>
              <StyleSelect
                value={form.lensType}
                onChange={handleLensChange}
                options={
                  lensOptions.length === 0
                    ? [{ value: '', label: lensTypesLoading ? 'Loading…' : 'No lens types configured' }]
                    : lensOptions
                }
                placeholder={lensTypesLoading ? 'Loading…' : 'Select lens type…'}
                icon={Glasses}
                openUp={false}
                disabled={lensOptions.length === 0 || !canEditField('lensType')}
              />
            </div>
            <div>
              <label className="label">Lens Amount (KES) <span className="text-rose-500">*</span></label>
              <input
                className={`input ${inputDisabled('lensAmount')}`}
                type="number"
                min="0"
                step="0.01"
                name="lensAmount"
                value={form.lensAmount}
                onChange={onChange}
                disabled={!canEditField('lensAmount')}
                title={!canEditField('lensAmount') ? 'Only admins can change this field' : ''}
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Auto-filled from the selected lens type - you can still adjust it.
              </p>
            </div>
            <div>
              <label className="label">Frame Code <span className="text-rose-500">*</span></label>
              <input
                className={`input ${inputDisabled('frameCode')}`}
                name="frameCode"
                value={form.frameCode}
                onChange={onChange}
                disabled={!canEditField('frameCode')}
                title={!canEditField('frameCode') ? 'Only admins can change this field' : ''}
                required
              />
            </div>
            <div>
              <label className="label">Frame Amount (KES) <span className="text-rose-500">*</span></label>
              <input
                className={`input ${inputDisabled('frameAmount')}`}
                type="number"
                min="0"
                step="0.01"
                name="frameAmount"
                value={form.frameAmount}
                onChange={onChange}
                disabled={!canEditField('frameAmount')}
                title={!canEditField('frameAmount') ? 'Only admins can change this field' : ''}
                required
              />
            </div>

            {/* ─── Pre-Auth Date - Cash OR self-sponsored insurance → P.N.A. ─── */}
            <div>
              <label className="label">
                Pre-Auth Date
                {!isPreAuthNA && <span className="text-rose-500"> *</span>}
              </label>

              {isPreAuthNA ? (
                <input
                  className="input !bg-slate-50 !text-slate-500 cursor-not-allowed"
                  value="P.N.A."
                  disabled
                  title={
                    isCash
                      ? 'Pre-Auth not applicable for cash orders'
                      : 'Pre-Auth not applicable for this insurer (self-sponsored)'
                  }
                />
              ) : (
                <input
                  className={`input ${inputDisabled('preAuthDate')}`}
                  type="date"
                  name="preAuthDate"
                  value={form.preAuthDate}
                  onChange={onChange}
                  disabled={!canEditField('preAuthDate')}
                  title={!canEditField('preAuthDate') ? 'Only admins can change this field' : ''}
                  required
                />
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                {isCash
                  ? 'Pre-Auth not applicable for cash orders.'
                  : isPreAuthNA
                    ? 'Pre-Auth not applicable for this insurer (self-sponsored).'
                    : 'Required for insurance orders.'}
              </p>
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
                onChange={({ scheme, insurance }) => {
                  if (!canEditField('scheme') && !canEditField('insurance')) return;
                  setForm((f) => ({
                    ...f,
                    scheme,
                    insurance,
                    // Clear pre-auth when the new combination is N/A
                    // (Cash, OR Insurance + self-sponsored insurer like Embu)
                    ...(isPreAuthNotApplicable(scheme, insurance) ? { preAuthDate: '' } : {}),
                  }));
                }}
              />
            </div>
          </div>

          {/* Prescription */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Prescription
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="label">RX BE <span className="text-rose-500">*</span></label>
                <input
                  className={`input ${inputDisabled('rxBe')}`}
                  name="rxBe"
                  value={form.rxBe}
                  onChange={onChange}
                  disabled={!canEditField('rxBe')}
                  title={!canEditField('rxBe') ? 'Only admins can change this field' : ''}
                  placeholder="e.g. -1.25"
                  required
                />
              </div>
              <div>
                <label className="label">ADD</label>
                <input
                  className={`input ${inputDisabled('rxAdd')}`}
                  name="rxAdd"
                  value={form.rxAdd}
                  onChange={onChange}
                  disabled={!canEditField('rxAdd')}
                  title={!canEditField('rxAdd') ? 'Only admins can change this field' : ''}
                  placeholder="e.g. +2.00"
                />
              </div>
              <div>
                <label className="label">PD <span className="text-rose-500">*</span></label>
                <input
                  className={`input ${inputDisabled('rxPd')}`}
                  name="rxPd"
                  value={form.rxPd}
                  onChange={onChange}
                  disabled={!canEditField('rxPd')}
                  title={!canEditField('rxPd') ? 'Only admins can change this field' : ''}
                  placeholder="e.g. 63"
                  required
                />
              </div>
            </div>
          </div>

          {/* Diagnoses */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Diagnoses ({diagnoses.length}/{MAX_DIAGNOSES})
              </p>
              {canEditField('diagnoses') && diagnoses.length < MAX_DIAGNOSES && (
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
                    <div className={`flex-1 ${!canEditField('diagnoses') ? 'opacity-60 pointer-events-none' : ''}`}>
                      <DiagnosisPicker
                        value={d}
                        onChange={(val) => setDiagnosis(i, val)}
                        required={i === 0}
                      />
                    </div>
                    {canEditField('diagnoses') && i > 0 && (
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
              className={`input ${inputDisabled('complaint')}`}
              rows="3"
              name="complaint"
              value={form.complaint}
              onChange={onChange}
              disabled={!canEditField('complaint')}
              title={!canEditField('complaint') ? 'Only admins can change this field' : ''}
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