import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, Pencil, Trash2, Save, Power, Glasses,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const LensTypes = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', price: '' });
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', active: true });

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/lens-types', { params: { q } });
      setItems(r.data);
    } catch {
      toast.error('Failed to load lens types');
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
    if (!createForm.name.trim()) return toast.error('Name is required');
    const price = Number(createForm.price);
    if (Number.isNaN(price) || price < 0) return toast.error('Valid price is required');
    try {
      await api.post('/lens-types', { name: createForm.name.trim(), price });
      toast.success('Lens type created');
      setCreateOpen(false);
      setCreateForm({ name: '', price: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    }
  };

  const openEdit = (i) => {
    setEditTarget(i);
    setEditForm({ name: i.name, price: String(i.price), active: Boolean(i.active) });
  };

  const saveEdit = async () => {
    const price = Number(editForm.price);
    if (Number.isNaN(price) || price < 0) return toast.error('Valid price is required');
    try {
      await api.put(`/lens-types/${editTarget._id}`, {
        name: editForm.name.trim(),
        price,
        active: editForm.active,
      });
      toast.success('Updated');
      setEditTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const remove = async (i) => {
    if (!confirm(`Delete ${i.name}?`)) return;
    try {
      await api.delete(`/lens-types/${i._id}`);
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
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Glasses size={18} className="text-sky-600" /> Lens Types
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length} lens type(s) {isAdmin ? '· click to edit' : '· read-only'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary !py-1.5 !px-3 !text-xs">
            <Plus size={13} /> Add Lens Type
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !py-2 !pl-8 !text-xs"
          placeholder="Search lens types…"
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
                <th className="px-3 py-2 text-right font-semibold">Price</th>
                <th className="px-3 py-2 text-left font-semibold w-20">Status</th>
                {isAdmin && <th className="px-3 py-2 text-right font-semibold w-24">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-slate-400 text-xs">Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-slate-400 text-xs">
                  No lens types yet. {isAdmin ? 'Add one, or run `node scripts/seedLensTypes.js`.' : 'Ask an admin to seed them.'}
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
                    <Glasses size={12} className="text-slate-400" /> {i.name}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-700 tabular-nums font-semibold">
                    {money(i.price)}
                  </td>
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

      {/* Add modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Lens Type">
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. Progressive" required />
          </div>
          <div>
            <label className="label">Price (KES)</label>
            <input className="input" type="number" min="0" step="1" value={createForm.price} onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })} placeholder="e.g. 4500" required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" type="submit"><Save size={14} /> Create</button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit ${editTarget?.name || ''}`}>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Price (KES)</label>
            <input className="input" type="number" min="0" step="1" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <span className="text-sm text-slate-700 flex items-center gap-2">
              <Power size={14} className="text-slate-500" /> Active (available in the form)
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

export default LensTypes;