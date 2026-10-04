import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import AuthShell from "../components/AuthShell";
import PasswordField from "../components/PasswordField";

function friendly(message: string) {
  if (/already registered|already been registered/i.test(message)) {
    return "An account with this email already exists. Log in instead.";
  }
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Try again in a few minutes.";
  return message;
}

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setError(friendly(error.message));
      return;
    }
    if (data.session) {
      navigate("/profile-setup", { replace: true });
    } else {
      setInfo("Check your email to confirm your account, then log in.");
    }
  };

  return (
    <AuthShell
      title="Create an account"
      subtitle="Report problems and share live runs."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" state={location.state} className="font-semibold text-brand-700 underline">
            Log in
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
          label="Password (at least 8 characters)"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm"
          label="Repeat password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-emerald-700">{info}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Please wait..." : "Create an account"}
        </button>
      </form>

      <p className="mt-4 text-xs text-gray-500">
        Your reports and live runs are linked to your account. You can delete
        the account at any time in Settings.
      </p>

      <div className="my-5 flex items-center">
        <div className="flex-1 border-t border-gray-200" />
        <span className="px-3 text-xs text-gray-400">or</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>
      <button type="button" className="btn-ghost w-full" onClick={() => navigate("/home")}>
        Continue as guest
      </button>
    </AuthShell>
  );
}