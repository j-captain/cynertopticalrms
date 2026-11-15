import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus, KeyRound, Trash2, Save, AlertTriangle, CheckCircle2,
  ShieldAlert, ShieldCheck, Mail, UserCheck, Power,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';

const emptyForm = { name: '', email: '', password: '', role: 'staff' };

/* ────────────────────────────────────────────────────────────────── */
/* All roles - single source of truth for dropdowns and display      */
/* ────────────────────────────────────────────────────────────────── */
const ROLES = [
  { value: 'staff', label: 'staff' },
  { value: 'admin', label: 'admin' },
  { value: 'director', label: 'director' },
  { value: 'optician', label: 'optician' },
];

const normalizeRole = (role) =>
  ROLES.some((r) => r.value === role) ? role : 'staff';

const Users = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  /* ── Create: gate → form → confirm → activation choice ── */
  const [createStage, setCreateStage] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);

  /* ── Activation choice ── */
  const [activationOpen, setActivationOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  /* ── Reset password ── */
  const [pwUser, setPwUser] = useState(null);
  const [pwStage, setPwStage] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [pwWorking, setPwWorking] = useState(false);

  /* ── Delete ── */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteText, setDeleteText] = useState('');
  const [deleteWorking, setDeleteWorking] = useState(false);

  /* ── Shared success modal ── */
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isAdmin = user?.role === 'admin';
  const selfId = String(user?.id ?? user?._id ?? '');
  const isSelf = (u) => String(u._id) === selfId;
  const DELETE_WORD = 'DELETE';

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/users');
      setUsers(r.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  /* ─── Create ─── */
  const openCreate = () => {
    setForm(emptyForm);
    setCreateStage('gate');
  };

  const proceedFromGate = () => setCreateStage('form');

  const proceedCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return toast.error('Name, email and password are required');
    }
    if (form.password.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }
    setCreateStage('confirm');
  };

  const confirmCreate = async () => {
    setCreating(true);
    try {
      const r = await api.post('/users', form);
      setCreatedUser(r.data);
      setCreateStage(null);
      setForm(emptyForm);
      setActivationOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  /* ─── Activation choice ─── */
  const closeActivation = () => {
    if (activating) return;
    setActivationOpen(false);
    setCreatedUser(null);
  };

  const activateDirect = async () => {
    if (!createdUser) return;
    setActivating(true);
    try {
      await api.post(`/users/${createdUser._id}/activate`);
      setActivationOpen(false);
      setSuccessMsg(
        `Account for ${createdUser.name} (${createdUser.email}) activated by admin.`
      );
      setSuccessOpen(true);
      setCreatedUser(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Activation failed');
    } finally {
      setActivating(false);
    }
  };

  const activateViaEmail = async () => {
    if (!createdUser) return;
    setActivating(true);
    try {
      await api.post(`/users/${createdUser._id}/activate/email`);
      setActivationOpen(false);
      setSuccessMsg(
        `Activation email successfully sent to ${createdUser.email}.`
      );
      setSuccessOpen(true);
      setCreatedUser(null);
      load();
      setTimeout(() => setSuccessOpen(false), 4000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email send failed');
    } finally {
      setActivating(false);
    }
  };

  /* ─── Role update ─── */
  const updateRole = async (u, role) => {
    try {
      await api.put(`/users/${u._id}`, { role });
      toast.success('Role updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  /* ─── Reset password ─── */
  const openResetGate = (u) => {
    setPwUser(u);
    setNewPw('');
    setPwStage('gate');
  };

  const closeReset = () => {
    if (pwWorking) return;
    setPwStage(null);
    setPwUser(null);
    setNewPw('');
  };

  const proceedResetEntry = () => setPwStage('enter');
  const proceedResetConfirm = () => {
    if (newPw.length < 8) return toast.error('Min 8 characters');
    setPwStage('confirm');
  };
  const backToEnter = () => {
    if (pwWorking) return;
    setPwStage('enter');
  };

  const confirmReset = async () => {
    if (!pwUser) return;
    setPwWorking(true);
    try {
      await api.post(`/users/${pwUser._id}/reset-password`, { password: newPw });
      const name = pwUser?.name || 'user';
      setPwStage(null);
      setPwUser(null);
      setNewPw('');
      setSuccessMsg(`Password reset for ${name}. They must use the new password on next login.`);
      setSuccessOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setPwWorking(false);
    }
  };

  /* ─── Delete ─── */
  const openDeleteConfirm = (u) => {
    setDeleteTarget(u);
    setDeleteText('');
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setDeleteWorking(true);
    try {
      await api.delete(`/users/${deleteTarget._id}`);
      setSuccessMsg(`User ${deleteTarget.name} (${deleteTarget.email}) deleted.`);
      setDeleteTarget(null);
      setSuccessOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">Manage staff accounts and access levels.</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><UserPlus size={16} /> Add User</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Last Login</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading…</td></tr>}
              {users.map((u) => {
                const safeRole = normalizeRole(u.role);
                const locked = isSelf(u) || !isAdmin;
                const active = u.isActive !== false;
                return (
                  <tr key={u._id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-800">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={safeRole}
                        onChange={(e) => updateRole(u, e.target.value)}
                        disabled={locked}
                        title={
                          isSelf(u)
                            ? 'You cannot change your own role'
                            : !isAdmin
                              ? 'Admin only'
                              : ''
                        }
                        className={`rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold ${
                          locked ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openResetGate(u)}
                          disabled={!isAdmin}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                          title={!isAdmin ? 'Admin only' : 'Reset password'}
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(u)}
                          disabled={isSelf(u) || !isAdmin}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          title={
                            isSelf(u)
                              ? 'You cannot delete yourself'
                              : !isAdmin
                                ? 'Admin only'
                                : 'Delete'
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create: GATE ─── */}
      <Modal
        open={createStage === 'gate'}
        onClose={() => setCreateStage(null)}
        title="Add User"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            <UserPlus className="text-sky-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              You're about to create a new user account.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              New accounts start <strong>inactive</strong>. After creation you'll choose how to activate them.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setCreateStage(null)}>Cancel</button>
            <button className="btn-primary" onClick={proceedFromGate}>
              <UserPlus size={14} /> Proceed
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Create: FORM ─── */}
      <Modal open={createStage === 'form'} onClose={() => setCreateStage(null)} title="Add User">
        <form onSubmit={proceedCreate} className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><label className="label">Password</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setCreateStage(null)}>Cancel</button>
            <button className="btn-primary" type="submit"><Save size={16} /> Continue</button>
          </div>
        </form>
      </Modal>

      {/* ─── Create: CONFIRM ─── */}
      <Modal
        open={createStage === 'confirm'}
        onClose={() => !creating && setCreateStage('form')}
        title="Confirm New User"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            <UserPlus className="text-sky-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Create a new <span className="font-semibold text-slate-800">{form.role}</span> account for <span className="font-semibold">{form.name || '-'}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              The account will be created inactive. You'll choose how to activate it next.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between"><span>Name</span><span className="font-semibold text-slate-800">{form.name || '-'}</span></div>
            <div className="flex justify-between"><span>Email</span><span className="font-semibold text-slate-800 break-all ml-2">{form.email || '-'}</span></div>
            <div className="flex justify-between"><span>Role</span><span className="font-semibold text-slate-800">{form.role}</span></div>
          </div>

          <p className="text-[11px] text-amber-700 flex items-start gap-1">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            The password will be set exactly as entered. Share it securely with the user.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setCreateStage('form')} disabled={creating}>Back</button>
            <button className="btn-primary" onClick={confirmCreate} disabled={creating}>
              {creating ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><CheckCircle2 size={14} /> Create User</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Activation choice ─── */}
      <Modal
        open={activationOpen}
        onClose={closeActivation}
        title="Activate Account"
        width="max-w-lg"
      >
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-50 grid place-items-center">
            <ShieldAlert className="text-amber-600" size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700 font-semibold">
              Account successfully created. Account inactive.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Choose how to activate <strong>{createdUser?.name}</strong> ({createdUser?.email}). The user cannot log in until activated.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={activateDirect}
              disabled={activating}
              className="w-full flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 p-3 text-left transition disabled:opacity-60"
            >
              <div className="rounded-lg bg-emerald-100 p-2 shrink-0">
                <UserCheck className="text-emerald-700" size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Activate now (admin)</p>
                <p className="text-xs text-emerald-700/80">Activate immediately. The user can log in right away.</p>
              </div>
            </button>

            <button
              onClick={activateViaEmail}
              disabled={activating}
              className="w-full flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 p-3 text-left transition disabled:opacity-60"
            >
              <div className="rounded-lg bg-amber-100 p-2 shrink-0">
                <Mail className="text-amber-700" size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Send activation email</p>
                <p className="text-xs text-amber-700/80">Email an 8-character code. User activates within 5 minutes.</p>
              </div>
            </button>
          </div>

          {activating && (
            <p className="text-center text-xs text-slate-400">
              <span className="inline-block h-3 w-3 mr-1 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin align-middle" />
              Working…
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={closeActivation} disabled={activating}>
              Decide Later
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Reset password: gate / enter / confirm ─── */}
      <Modal open={pwStage === 'gate'} onClose={closeReset} title="Reset Password" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 grid place-items-center">
            <ShieldAlert className="text-amber-600" size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Reset the password for <span className="font-semibold">{pwUser?.name || '-'}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Their current password will be invalidated immediately. They will only be able to log in with the new password you set in the next step.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between"><span>Name</span><span className="font-semibold text-slate-800">{pwUser?.name || '-'}</span></div>
            <div className="flex justify-between"><span>Email</span><span className="font-semibold text-slate-800 break-all ml-2">{pwUser?.email || '-'}</span></div>
            <div className="flex justify-between"><span>Role</span><span className="font-semibold text-slate-800">{normalizeRole(pwUser?.role)}</span></div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={closeReset} disabled={pwWorking}>Cancel</button>
            <button className="btn-primary" onClick={proceedResetEntry}>
              <KeyRound size={14} /> Reset
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={pwStage === 'enter'} onClose={closeReset} title="Set New Password" width="max-w-md">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Choose a new password for <span className="font-semibold">{pwUser?.name}</span> ({pwUser?.email}).
          </p>
          <div>
            <label className="label">New Password</label>
            <input
              className="input"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              minLength={8}
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {newPw
                ? newPw.length < 8
                  ? <span className="text-rose-500">Too short - minimum 8 characters</span>
                  : <span className="text-emerald-600">Looks good.</span>
                : 'Minimum 8 characters'}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={closeReset} disabled={pwWorking}>Cancel</button>
            <button className="btn-primary" onClick={proceedResetConfirm} disabled={newPw.length < 8}>
              Continue
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={pwStage === 'confirm'}
        onClose={() => !pwWorking && backToEnter()}
        title="Confirm Password Reset"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center">
            <ShieldAlert className="text-rose-600" size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Confirm reset for <span className="font-semibold">{pwUser?.name}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Their old password will stop working immediately. Only the new password will grant access.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between"><span>Name</span><span className="font-semibold text-slate-800">{pwUser?.name || '-'}</span></div>
            <div className="flex justify-between"><span>Email</span><span className="font-semibold text-slate-800 break-all ml-2">{pwUser?.email || '-'}</span></div>
            <div className="flex justify-between"><span>Role</span><span className="font-semibold text-slate-800">{normalizeRole(pwUser?.role)}</span></div>
          </div>
          <p className="text-[11px] text-amber-700 flex items-start gap-1">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            Make sure you have communicated the new password to the user via a secure channel.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={backToEnter} disabled={pwWorking}>Back</button>
            <button className="btn-danger" onClick={confirmReset} disabled={pwWorking}>
              {pwWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-600 animate-spin" />
              ) : (
                <><KeyRound size={14} /> Reset Password</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Delete ─── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleteWorking && setDeleteTarget(null)}
        title="Delete User"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center">
            <AlertTriangle className="text-rose-500" size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Delete the user <span className="font-semibold">{deleteTarget?.name}</span>?
            </p>
            <p className="text-xs text-rose-600 font-semibold mt-1">This cannot be undone.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between"><span>Name</span><span className="font-semibold text-slate-800">{deleteTarget?.name || '-'}</span></div>
            <div className="flex justify-between"><span>Email</span><span className="font-semibold text-slate-800 break-all ml-2">{deleteTarget?.email || '-'}</span></div>
            <div className="flex justify-between"><span>Role</span><span className="font-semibold text-slate-800">{normalizeRole(deleteTarget?.role)}</span></div>
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
            <button className="btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleteWorking}>Cancel</button>
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

      {/* ─── Shared success modal ─── */}
      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Success"
        message={successMsg}
      />
    </div>
  );
};

export default Users;