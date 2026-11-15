import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Mail, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const Settings = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then((r) => setS(r.data)).catch(() => toast.error('Failed to load'));
  }, []);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setS((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        orderRecipientEmail: s.orderRecipientEmail,
        smtpFromName: s.smtpFromName,
        smtpFromEmail: s.smtpFromEmail,
        clinicName: s.clinicName,
        currency: s.currency,
        allowCustomRecipient: s.allowCustomRecipient,
        notifyOnFailures: s.notifyOnFailures,
      };
      await api.put('/settings', payload);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <div className="card p-6 animate-pulse h-40 bg-slate-100" />;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure order delivery and clinic identity.</p>
      </div>

      <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={save} className="card p-6 space-y-5">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Mail size={16} /> Order Email Delivery
        </div>

        <div>
          <label className="label">Default Order Recipient Email</label>
          <input className="input" name="orderRecipientEmail" type="email" value={s.orderRecipientEmail || ''} onChange={onChange} placeholder="orders@cynert.com" disabled={!isAdmin} />
          {!s.orderRecipientEmail && s.envFallbackConfigured && (
            <p className="text-xs text-amber-600 mt-1">Using env fallback. Set a value here to override.</p>
          )}
          {!s.orderRecipientEmail && !s.envFallbackConfigured && (
            <p className="text-xs text-rose-600 mt-1">Not configured. Default-mail orders will fail until set.</p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">From Name</label>
            <input className="input" name="smtpFromName" value={s.smtpFromName || ''} onChange={onChange} disabled={!isAdmin} />
          </div>
          <div>
            <label className="label">From Email</label>
            <input className="input" name="smtpFromEmail" type="email" value={s.smtpFromEmail || ''} onChange={onChange} disabled={!isAdmin} />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input type="checkbox" checked={!!s.allowCustomRecipient} onChange={onChange} name="allowCustomRecipient" id="allowCustom" disabled={!isAdmin} className="mt-1" />
          <label htmlFor="allowCustom" className="text-sm text-slate-700">
            Allow users to send orders to a custom recipient email
          </label>
        </div>

        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm pt-2">
          <ShieldCheck size={16} /> Clinic Identity
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Clinic Name</label>
            <input className="input" name="clinicName" value={s.clinicName || ''} onChange={onChange} disabled={!isAdmin} />
          </div>
          <div>
            <label className="label">Currency</label>
            <input className="input" name="currency" value={s.currency || 'KES'} onChange={onChange} disabled={!isAdmin} />
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input type="checkbox" checked={!!s.notifyOnFailures} onChange={onChange} name="notifyOnFailures" id="notify" disabled={!isAdmin} className="mt-1" />
          <label htmlFor="notify" className="text-sm text-slate-700">
            Flag failed email deliveries on dashboard
          </label>
        </div>

        {isAdmin && (
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><Save size={16} /> Save Settings</>}
            </button>
          </div>
        )}
        {!isAdmin && <p className="text-xs text-slate-500">Only admins can edit settings.</p>}
      </motion.form>
    </div>
  );
};

export default Settings;