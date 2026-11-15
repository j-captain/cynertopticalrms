import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const ActivateAccount = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('working');
  const [message, setMessage] = useState('Activating your account…');

  useEffect(() => {
    fetch(`/api/auth/activate/${token}`, { method: 'GET', redirect: 'manual' })
      .then((res) => {
        // activateAccount redirects on success. Follow the redirect manually.
        if (res.type === 'opaqueredirect' || res.status === 0 || res.redirected) {
          setStatus('success');
          setMessage('Account activated. Redirecting to login…');
          setTimeout(() => navigate('/login?activated=1'), 1200);
        } else if (res.status === 400) {
          return res.json().then((d) => {
            setStatus('error');
            setMessage(d.message || 'Activation link is invalid or has expired.');
          });
        } else {
          setStatus('error');
          setMessage('Something went wrong. Please contact your administrator.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Could not reach the server.');
      });
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="card p-8 max-w-md w-full text-center space-y-4">
        {status === 'working' && (
          <>
            <Loader2 className="mx-auto animate-spin text-sky-600" size={36} />
            <p className="text-sm text-slate-600">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 grid place-items-center">
              <CheckCircle2 className="text-emerald-600" size={28} />
            </div>
            <p className="text-sm text-slate-700 font-semibold">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto h-14 w-14 rounded-full bg-rose-50 grid place-items-center">
              <AlertTriangle className="text-rose-600" size={28} />
            </div>
            <p className="text-sm text-slate-700 font-semibold">Activation failed</p>
            <p className="text-xs text-slate-500">{message}</p>
            <button onClick={() => navigate('/login')} className="btn-primary mt-2">Go to Login</button>
          </>
        )}
      </div>
    </div>
  );
};

export default ActivateAccount;