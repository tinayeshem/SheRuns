import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { useProfileStore } from "../store/profileStore";
import AuthShell from "../components/AuthShell";
import PasswordField from "../components/PasswordField";

type From = { pathname: string; search?: string; state?: unknown };

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first, then log in.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Try again in a few minutes.";
  return message;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: From } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setError(friendly(error.message));
      return;
    }
    if (!useProfileStore.getState().completed) {
      navigate("/profile-setup", { replace: true });
    } else {
      navigate((from?.pathname ?? "/home") + (from?.search ?? ""), {
        replace: true,
        state: from?.state,
      });
    }
  };

  const forgot = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Enter your email above first.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error && /rate limit|too many/i.test(error.message)) {
      setError("Too many emails sent. Try again later.");
      return;
    }
    setInfo("If an account exists for this email, we sent a reset link.");
  };

  return (
    <AuthShell
      title="Welcome :)"
      subtitle={from ? "Log in to continue." : "Log in to report problems and share live runs."}
      footer={
        <>
          No account?{" "}
          <Link to="/signup" state={location.state} className="font-semibold text-brand-700 underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-brand-950">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-emerald-700">{info}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Please wait..." : "Log in"}
        </button>
      </form>

      <button
        type="button"
        onClick={forgot}
        disabled={busy}
        className="mt-3 w-full text-sm text-gray-600 underline"
      >
        Forgot your password?
      </button>

      <div className="my-5 flex items-center">
        <div className="flex-1 border-t border-gray-200" />
        <span className="px-3 text-xs text-gray-400">or</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <button type="button" className="btn-ghost w-full" onClick={() => navigate("/home")}>
        Continue as guest
      </button>
      <p className="mt-2 text-center text-xs text-gray-500">
        Guests can see scores and plan routes. Reporting and live runs need an account.
      </p>
    </AuthShell>
  );
}