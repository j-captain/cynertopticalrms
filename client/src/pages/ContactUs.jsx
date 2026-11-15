import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Mail, Phone, MapPin, Send, Headset, MessageSquare,
  Clock, ExternalLink, Copy, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const SUPPORT_EMAIL = 'support@cynertoptical.com';       // ← change to your email
const SUPPORT_PHONE = '+254 700 000 000';                // ← change to your phone
const SUPPORT_ADDRESS = 'Nairobi, Kenya';                // ← change to your address

const ContactUs = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [copied, setCopied] = useState(null);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      return toast.error('Please fill in name, email, and message');
    }
    // Mailto - opens the user's mail client with everything pre-filled
    const subject = encodeURIComponent(form.subject || `Contact from ${form.name}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    toast.success('Opening your mail app…');
  };

  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success('Copied');
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Contact Us</h1>
            <p className="text-xs text-slate-500 mt-0.5">We're here to help. Reach out any time.</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid md:grid-cols-5 gap-4"
        >
          {/* Form - left */}
          <div className="md:col-span-3 card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="rounded-lg bg-sky-50 p-2">
                <MessageSquare className="text-sky-600" size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Send a message</h2>
                <p className="text-xs text-slate-500">We reply within 1 business day</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Your name</label>
                  <input
                    className="input"
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    placeholder="Jane Doe"
                    required
                  />
                </div>
                <div>
                  <label className="label">Your email</label>
                  <input
                    className="input"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder="jane@example.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Subject</label>
                <input
                  className="input"
                  name="subject"
                  value={form.subject}
                  onChange={onChange}
                  placeholder="How can we help?"
                />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea
                  className="input"
                  rows="5"
                  name="message"
                  value={form.message}
                  onChange={onChange}
                  placeholder="Tell us what you need help with…"
                  required
                />
              </div>
              <div className="flex justify-end pt-1">
                <button type="submit" className="btn-primary">
                  <Send size={14} /> Send Message
                </button>
              </div>
            </form>
          </div>

          {/* Info - right */}
          <div className="md:col-span-2 space-y-3">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-lg bg-emerald-50 p-2">
                  <Headset className="text-emerald-600" size={18} />
                </div>
                <h2 className="text-sm font-bold text-slate-800">Get in touch directly</h2>
              </div>

              <ul className="space-y-3 text-xs">
                <li className="flex items-start gap-2">
                  <Mail size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-500">Email</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="font-semibold text-slate-800 hover:text-sky-600 truncate"
                      >
                        {SUPPORT_EMAIL}
                      </a>
                      <button
                        onClick={() => copy(SUPPORT_EMAIL, 'email')}
                        className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                        title="Copy"
                      >
                        {copied === 'email' ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Phone size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-500">Phone</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <a
                        href={`tel:${SUPPORT_PHONE.replace(/\s+/g, '')}`}
                        className="font-semibold text-slate-800 hover:text-sky-600"
                      >
                        {SUPPORT_PHONE}
                      </a>
                      <button
                        onClick={() => copy(SUPPORT_PHONE, 'phone')}
                        className="rounded p-0.5 text-slate-400 hover:text-slate-700"
                        title="Copy"
                      >
                        {copied === 'phone' ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-500">Address</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{SUPPORT_ADDRESS}</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Clock size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-500">Business hours</p>
                    <p className="font-semibold text-slate-800 mt-0.5">Mon–Fri · 8am–5pm</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-2">Prefer a form?</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Fill in the form on the left - it opens your mail app with everything ready to send.
                No account needed.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700"
              >
                <ExternalLink size={12} /> Email {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ContactUs;