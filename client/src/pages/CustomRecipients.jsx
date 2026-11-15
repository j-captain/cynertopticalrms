import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, Pencil, Trash2, Save, Power, Mail, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const CustomRecipients = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', label: '' });
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', label: '', active: true });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/custom-recipients', { params: { q } });
      setItems(r.data);
    } catch {
      toast.error('Failed to load recipients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const create = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim()) {
      return toast.error('Name and email are required');
    }
    try {
      await api.post('/custom-recipients', createForm);
      toast.success('Recipient created');
      setCreateOpen(false);
      setCreateForm({ name: '', email: '', label: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    }
  };

  const openEdit = (i) => {
    setEditTarget(i);
    setEditForm({
      name: i.name,
      email: i.email,
      label: i.label || '',
      active: Boolean(i.active),
    });
  };

  const saveEdit = async () => {
    try {
      await api.put(`/custom-recipients/${editTarget._id}`, editForm);
      toast.success('Updated');
      setEditTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const remove = async (i) => {
    if (!confirm(`Delete ${i.name} <${i.email}>?`)) return;
    try {
      await api.delete(`/custom-recipients/${i._id}`);
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Custom Recipients</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length} recipient(s) {isAdmin ? '· click to edit' : '· read-only'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary !py-1.5 !px-3 !text-xs">
            <Plus size={13} /> Add Recipient
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !py-2 !pl-8 !text-xs"
          placeholder="Search by name, email, or label…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left font-semibold">Name</th>
                <th className="px-3 py-2 text-left font-semibold">Email</th>
                <th className="px-3 py-2 text-left font-semibold">Label</th>
                <th className="px-3 py-2 text-left font-semibold w-20">Status</th>
                {isAdmin && <th className="px-3 py-2 text-right font-semibold w-24">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-slate-400 text-xs">Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-slate-400 text-xs">
                  No recipients yet. {isAdmin ? 'Add one, or run `node scripts/seedCustomRecipients.js`.' : 'Ask an admin to seed them.'}
                </td></tr>
              )}
              {items.map((i, idx) => (
                <motion.tr
                  key={i._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.01, 0.1) }}
                  className="border-t border-slate-100 hover:bg-sky-50/40"
                >
                  <td className="px-3 py-1.5 font-semibold text-slate-800 flex items-center gap-2">
                    <User size={12} className="text-slate-400" /> {i.name}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 font-mono">{i.email}</td>
                  <td className="px-3 py-1.5 text-slate-500">{i.label || '-'}</td>
                  <td className="px-3 py-1.5">
                    {i.active ? (
                      <span className="badge bg-emerald-50 text-emerald-700">Active</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">Inactive</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-1.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(i)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => remove(i)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Custom Recipient">
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. Cynert Orders" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="e.g. orders@cynert.com" required />
          </div>
          <div>
            <label className="label">Label (optional)</label>
            <input className="input" value={createForm.label} onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })} placeholder="e.g. Main inbox" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" type="submit"><Save size={14} /> Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit ${editTarget?.name || ''}`}>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Label</label>
            <input className="input" value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <span className="text-sm text-slate-700 flex items-center gap-2">
              <Power size={14} className="text-slate-500" /> Active (available in the order form)
            </span>
            <button
              type="button"
              onClick={() => setEditForm((f) => ({ ...f, active: !f.active }))}
              className={`relative h-6 w-11 rounded-full transition ${editForm.active ? 'bg-sky-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${editForm.active ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setEditTarget(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit}><Save size={14} /> Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomRecipients;