import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { session, signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (session) nav({ to: "/" }); }, [session, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setErr(error);
    else nav({ to: "/" });
  };

  return (
    <div className="min-h-screen relative grid place-items-center bg-slate-950 overflow-hidden p-3 sm:p-4">
      <div className="absolute -top-32 -left-32 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-blue-600/30 blur-3xl animate-pulse" />
      <div className="absolute -bottom-32 -right-32 h-64 w-64 sm:h-96 sm:w-96 rounded-full bg-indigo-600/30 blur-3xl animate-pulse" />

      <div className="relative w-full max-w-md rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/10 p-5 sm:p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-5 sm:mb-6">
          <img src="/logo.jpg" alt="Tech Minds" className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-cover mb-3" />
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">IT COMPANY HRMS</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Secure Portal Sign In</p>
        </div>

        {err && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{err}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-brand"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-brand"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-brand text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? "Authenticating..." : <><LogIn className="h-4 w-4" /> Sign In</>}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs text-slate-400 mb-3 font-medium">DEMO CREDENTIALS</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Admin:</span><span className="font-mono">admin@hrms.com / admin@123</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Employee:</span><span className="font-mono">employee@hrms.com / employee@123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
