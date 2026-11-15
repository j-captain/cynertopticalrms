import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, Pencil, Trash2, Save, AlertTriangle, Stethoscope,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ICD11Codes = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ code: '', description: '' });
  const [createWorking, setCreateWorking] = useState(false);

  // Edit - gate modal, form modal, confirm modal
  const [editGateTarget, setEditGateTarget] = useState(null); // confirmation BEFORE opening the form
  const [editTarget, setEditTarget] = useState(null);         // the actual edit form
  const [editForm, setEditForm] = useState({ code: '', description: '' });
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [editWorking, setEditWorking] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteText, setDeleteText] = useState('');
  const [deleteWorking, setDeleteWorking] = useState(false);

  // Success
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const DELETE_WORD = 'DELETE';

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/icd11', { params: { q } });
      setItems(r.data);
    } catch {
      toast.error('Failed to load codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // ─── Create ───
  const openCreate = () => {
    setCreateForm({ code: '', description: '' });
    setCreateOpen(true);
  };

  const runCreate = async (e) => {
    e.preventDefault();
    if (!createForm.code.trim() || !createForm.description.trim()) {
      return toast.error('Both code and description are required');
    }
    setCreateWorking(true);
    try {
      await api.post('/icd11', {
        code: createForm.code.trim(),
        description: createForm.description.trim(),
      });
      setCreateOpen(false);
      setSuccessMsg(`Code "${createForm.code.toUpperCase()}" created.`);
      setSuccessOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally {
      setCreateWorking(false);
    }
  };

  // ─── Edit ───
  const openEditGate = (i) => {
    setEditGateTarget(i);
  };

  const proceedToEditForm = () => {
    const target = editGateTarget;
    setEditGateTarget(null);
    setEditTarget(target);
    setEditForm({ code: target.code, description: target.description });
  };

  const proceedEdit = () => {
    if (!editForm.code.trim() || !editForm.description.trim()) {
      return toast.error('Both code and description are required');
    }
    setEditConfirmOpen(true);
  };

  const runEdit = async () => {
    if (!editTarget) return;
    setEditWorking(true);
    try {
      await api.put(`/icd11/${editTarget._id}`, {
        code: editForm.code.trim(),
        description: editForm.description.trim(),
      });
      const newCode = editForm.code.toUpperCase();
      setEditConfirmOpen(false);
      setEditTarget(null);
      setSuccessMsg(`Code "${newCode}" updated successfully.`);
      setSuccessOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setEditWorking(false);
    }
  };

  // ─── Delete ───
  const openDelete = (i) => {
    setDeleteTarget(i);
    setDeleteText('');
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setDeleteWorking(true);
    try {
      await api.delete(`/icd11/${deleteTarget._id}`);
      const code = deleteTarget.code;
      setDeleteTarget(null);
      setDeleteText('');
      setSuccessMsg(`Code "${code}" deleted.`);
      setSuccessOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteWorking(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Stethoscope size={18} className="text-sky-600" /> ICD-11 Codes
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {items.length} reference code(s) {isAdmin ? '· click to edit' : '· read-only'}
            </p>
          </div>
          {isAdmin && (
            <button onClick={openCreate} className="btn-primary !py-1.5 !px-3 !text-xs">
              <Plus size={13} /> Add Code
            </button>
          )}
        </div>

        <div className="relative max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-2 !pl-8 !text-xs"
            placeholder="Search by code or description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2 text-left font-semibold w-32">Code</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  {isAdmin && <th className="px-3 py-2 text-right font-semibold w-24">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={isAdmin ? 3 : 2} className="text-center py-8 text-slate-400 text-xs">Loading…</td></tr>
                )}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={isAdmin ? 3 : 2} className="text-center py-8 text-slate-400 text-xs">
                    No codes yet. {isAdmin ? 'Add one, or run `node scripts/seedICD11.js`.' : 'Ask an admin to seed them.'}
                  </td></tr>
                )}
                {items.map((c, i) => (
                  <motion.tr
                    key={c._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.1) }}
                    className="border-t border-slate-100 hover:bg-sky-50/40"
                  >
                    <td className="px-3 py-1.5 font-mono font-semibold text-sky-700">{c.code}</td>
                    <td className="px-3 py-1.5 text-slate-700">{c.description}</td>
                    {isAdmin && (
                      <td className="px-3 py-1.5">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEditGate(c)}
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => openDelete(c)}
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
      </div>

      {/* ─── Create ─── */}
      <Modal open={createOpen} onClose={() => !createWorking && setCreateOpen(false)} title="Add ICD-11 Code">
        <form onSubmit={runCreate} className="space-y-3">
          <div>
            <label className="label">Code</label>
            <input
              className="input font-mono uppercase"
              value={createForm.code}
              onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
              placeholder="e.g. 9D90"
              required
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="e.g. Mild distance vision impairment"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={createWorking}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={createWorking}>
              {createWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Save size={14} /> Create</>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit GATE - confirm before opening the form ─── */}
      <Modal
        open={!!editGateTarget}
        onClose={() => setEditGateTarget(null)}
        title="Edit ICD-11 Code"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            <Pencil className="text-sky-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Open the editor for code <span className="font-mono font-semibold">{editGateTarget?.code}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              You can change both the code and its description. Changes take effect only after confirmation.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Code</span>
              <span className="font-mono font-semibold text-slate-800">{editGateTarget?.code}</span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="shrink-0">Description</span>
              <span className="text-slate-800 text-right">{editGateTarget?.description}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              className="btn-ghost"
              onClick={() => setEditGateTarget(null)}
            >
              Cancel
            </button>
            <button className="btn-primary" onClick={proceedToEditForm}>
              <Pencil size={14} /> Open Editor
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Edit FORM ─── */}
      <Modal
        open={!!editTarget && !editConfirmOpen}
        onClose={() => setEditTarget(null)}
        title={`Edit ${editTarget?.code || ''}`}
      >
        <div className="space-y-3">
          <div>
            <label className="label">Code</label>
            <input
              className="input font-mono uppercase"
              value={editForm.code}
              onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              placeholder="e.g. 9D90"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Code can now be edited. It will be uppercased and must be unique.
            </p>
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setEditTarget(null)}>Cancel</button>
            <button className="btn-primary" onClick={proceedEdit}>
              <Save size={14} /> Continue
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Edit CONFIRM ─── */}
      <Modal
        open={editConfirmOpen}
        onClose={() => !editWorking && setEditConfirmOpen(false)}
        title="Confirm Code Update"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            <Pencil className="text-sky-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Save changes to code <span className="font-mono font-semibold">{editTarget?.code}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Existing patients that already use this code are not affected.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500">Code</span>
              <span className="font-mono">
                <span className="line-through text-slate-400 mr-2">{editTarget?.code}</span>
                <span className="text-slate-800 font-semibold">{editForm.code.toUpperCase()}</span>
              </span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="text-slate-500 shrink-0">Description</span>
              <span className="text-right">
                {editTarget?.description !== editForm.description && (
                  <span className="line-through text-slate-400 mr-2 block">{editTarget?.description}</span>
                )}
                <span className="text-slate-800 font-semibold">{editForm.description}</span>
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setEditConfirmOpen(false)} disabled={editWorking}>
              Back
            </button>
            <button className="btn-primary" onClick={runEdit} disabled={editWorking}>
              {editWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Save size={14} /> Confirm</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Delete ─── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleteWorking && setDeleteTarget(null)}
        title="Delete ICD-11 Code"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center">
            <AlertTriangle className="text-rose-500" size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Delete the ICD-11 code <span className="font-mono font-semibold">{deleteTarget?.code}</span>?
            </p>
            <p className="text-xs text-rose-600 font-semibold mt-1">
              This cannot be undone.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Code</span>
              <span className="font-mono font-semibold text-slate-800">{deleteTarget?.code}</span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className="shrink-0">Description</span>
              <span className="text-slate-800 text-right">{deleteTarget?.description}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Patients that already have this code saved in their record will keep the historical value. The code
            simply disappears from the picker.
          </p>

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

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Success"
        message={successMsg}
      />
    </>
  );
};

export default ICD11Codes;