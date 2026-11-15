import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingP, setSavingP] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingP(true);
    try {
      await api.put('/auth/profile', profile);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSavingP(false);
    }
  };

  const savePw = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return toast.error('Passwords do not match');
    if (pw.newPassword.length < 8) return toast.error('Min 8 characters');
    setSavingPw(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      toast.success('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Change failed');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account information and password.</p>
      </div>

      <motion.form onSubmit={saveProfile} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm"><User size={16} /> Profile</div>
        <div><label className="label">Name</label><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
        <div><label className="label">Role</label><input className="input !bg-slate-50" value={user?.role} disabled /></div>
        <div className="flex justify-end"><button className="btn-primary" disabled={savingP}>{savingP ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><Save size={16} /> Save</>}</button></div>
      </motion.form>

      <motion.form onSubmit={savePw} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm"><Lock size={16} /> Change Password</div>
        <div><label className="label">Current Password</label><input className="input" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="label">New Password</label><input className="input" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} /></div>
          <div><label className="label">Confirm Password</label><input className="input" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required minLength={8} /></div>
        </div>
        <div className="flex justify-end"><button className="btn-primary" disabled={savingPw}>{savingPw ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><Lock size={16} /> Update Password</>}</button></div>
      </motion.form>
    </div>
  );
};

export default Profile;