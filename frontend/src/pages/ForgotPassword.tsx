import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6 text-slate-100 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-400 p-[1px] shadow-lg flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
              <span className="font-mono font-bold text-cyan-400 text-sm">BD</span>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Recovery Console</h2>
            <p className="text-[11px] font-mono text-slate-400 uppercase">BDIQ Platform Security</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-white tracking-tight mb-2">Reset Password</h1>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Enter your registered enterprise email address to receive password recovery instructions.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Password reset dispatch successful! Check your corporate inbox.</span>
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase font-mono tracking-wider mb-2">
              Corporate Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="block w-full pl-10 pr-4 py-2 rounded-lg border border-slate-800 bg-slate-950/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-medium text-sm shadow-md transition disabled:opacity-50"
          >
            {loading ? 'Transmitting...' : 'Dispatch Reset Link'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to secure sign-in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
