import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { validateEmail } from './services/auth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validateEmail(email)) {
      setError('Enter a valid email address');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }
    setSubmitting(true);
    setError(null);
    const message = await login(email, password);
    // On success the app switches screens; only a failure needs handling here.
    if (message) {
      setError(message);
      setPassword('');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center mb-6 shadow-2xl">
            <span className="text-white text-4xl font-bold tracking-[-1.5px]">ZK</span>
          </div>
          <h1 className="text-5xl font-semibold text-white tracking-[-1.5px]">ZIM KIOSK</h1>
          <p className="text-sky-400 mt-2 text-lg">Smart POS for Zimbabwe</p>
          <div className="mt-1 text-xs text-slate-500">Multi-currency • EcoCash • Multi-branch</div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="glass bg-slate-900/70 border border-slate-800 rounded-3xl p-8">
          <div className="mb-7">
            <h3 className="text-white text-xl font-semibold mb-1">Sign in to your store</h3>
            <p className="text-slate-400 text-sm">Use the account your administrator created for you.</p>
          </div>

          <label className="block text-xs text-slate-400 mb-1.5" htmlFor="email">Email</label>
          <div className="relative mb-5">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="email" type="email" autoComplete="username" autoFocus required
              value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourstore.co.zw"
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <label className="block text-xs text-slate-400 mb-1.5" htmlFor="password">Password</label>
          <div className="relative mb-5">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-12 pr-12 py-3.5 text-white focus:outline-none focus:border-sky-500"
            />
            <button
              type="button" onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div role="alert" className="mb-5 text-sm text-red-300 bg-red-950/50 border border-red-900/60 rounded-2xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-semibold py-3.5 rounded-2xl transition"
          >
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Signing in…</> : 'Sign in'}
          </button>

          <p className="mt-6 text-center text-xs text-slate-500">
            Forgot your password? Ask your administrator to reset it.
          </p>
        </form>
      </div>
    </div>
  );
}
