import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useProfileStore,
  type Contact,
  type RouteMode,
} from "../store/profileStore";
import { normalizePhone } from "../features/live/phone";
import { finishSession, loadSaved } from "../features/live/api";
import { useAuth } from "../features/auth/AuthProvider";
import { deleteAccountApi } from "../features/auth/api";

const TRAITS = [
  { key: "alone", label: "I run alone" },
  { key: "night", label: "I run at night" },
  { key: "dog", label: "I run with a dog" },
  { key: "beginner", label: "I'm a beginner" },
  { key: "lowVision", label: "I have low vision" },
];

const MODES: { key: RouteMode; label: string }[] = [
  { key: "fastest", label: "Fastest" },
  { key: "safest", label: "Safest" },
  { key: "scenic", label: "Scenic and safe" },
];

const MAX_CONTACTS = 5;

function wipeLocal() {
  try {
    for (const k of [
      "safe-run-profile",
      "safe-run-history",
      "safe-run-device",
      "safe-run-live",
    ]) {
      localStorage.removeItem(k);
    }
  } catch {
    // storage not available
  }
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { traits, routeMode, contacts, saveProfile } = useProfileStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accError, setAccError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (
    p: Partial<{ traits: string[]; routeMode: RouteMode; contacts: Contact[] }>
  ) => saveProfile({ traits, routeMode, contacts, ...p });

  const toggleTrait = (key: string) =>
    update({
      traits: traits.includes(key)
        ? traits.filter((t) => t !== key)
        : [...traits, key],
    });

  const addContact = () => {
    const n = name.trim();
    const raw = phone.trim();
    if (!n || !raw) {
      setError("Enter a name and a phone number.");
      return;
    }
    if (contacts.length >= MAX_CONTACTS) {
      setError(`You can save up to ${MAX_CONTACTS} contacts.`);
      return;
    }
    const stored = normalizePhone(raw) ?? raw;
    if (contacts.some((c) => (normalizePhone(c.phone) ?? c.phone) === stored)) {
      setError("This number is already in your list.");
      return;
    }
    update({ contacts: [...contacts, { name: n, phone: stored }] });
    setName("");
    setPhone("");
    setError(null);
  };

  const removeContact = (i: number) =>
    update({ contacts: contacts.filter((_, idx) => idx !== i) });

  const endActiveRun = async () => {
    const active = loadSaved();
    if (active) {
      await finishSession(active.token, active.ownerKey).catch(() => {});
    }
  };

  const deleteLocal = async () => {
    if (
      !window.confirm(
        "Delete your profile, contacts and run history from this device? A run in progress will be ended. Your account stays."
      )
    ) {
      return;
    }
    setBusy(true);
    await endActiveRun();
    wipeLocal();
    window.location.assign("/");
  };

  const logout = async () => {
    await signOut();
    navigate("/home");
  };

  const deleteAccount = async () => {
    if (
      !window.confirm(
        "Delete your account? This removes your login, ends any run in progress and cannot be undone."
      )
    ) {
      return;
    }
    setBusy(true);
    setAccError(null);
    try {
      await endActiveRun();
      await deleteAccountApi();
      await signOut();
      wipeLocal();
      window.location.assign("/");
    } catch (e) {
      setAccError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Settings</h1>
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="border rounded-lg px-3 py-1 text-sm bg-white"
          >
            Back
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Changes save automatically.</p>

        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <p className="font-bold mb-1">Account</p>
          {user ? (
            <>
              <p className="text-sm text-gray-700 mb-3">Signed in as {user.email}</p>
              <button
                type="button"
                onClick={logout}
                className="w-full border rounded-xl py-2 text-sm mb-2"
              >
                Log out
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={busy}
                className="w-full border border-red-300 text-red-700 rounded-xl py-2 text-sm disabled:opacity-60"
              >
                {busy ? "Working..." : "Delete my account"}
              </button>
              {accError && <p className="text-sm text-red-600 mt-2">{accError}</p>}
              <p className="text-xs text-gray-500 mt-2">
                Deleting your account removes your login, ends any run in
                progress, and unlinks your reports. They stay anonymous until
                they expire after 7 days.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-700 mb-3">
                You are browsing as a guest. Log in to report problems and share
                live runs.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full bg-green-600 text-white rounded-xl py-2 text-sm"
              >
                Log in
              </button>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <p className="font-bold mb-2">How do you run?</p>
          <div className="space-y-2">
            {TRAITS.map((t) => (
              <label key={t.key} className="flex items-center gap-3 border rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={traits.includes(t.key)}
                  onChange={() => toggleTrait(t.key)}
                />
                {t.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            These change how much each safety check counts in your scores.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <p className="font-bold mb-2">Route mode</p>
          <div className="space-y-2">
            {MODES.map((m) => (
              <label key={m.key} className="flex items-center gap-3 border rounded-lg px-3 py-2">
                <input
                  type="radio"
                  name="mode"
                  checked={routeMode === m.key}
                  onChange={() => update({ routeMode: m.key })}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <p className="font-bold mb-1">Trusted contacts</p>
          <p className="text-xs text-gray-500 mb-3">
            Saved on this device only. A number is sent to our server only when
            you tick the text alerts box at the start of a run, and it is
            deleted when the run ends. Up to 3 contacts get text alerts. Use the
            international format, for example +48 123 456 789.
          </p>

          {contacts.length === 0 && (
            <p className="text-sm text-gray-500 mb-3">No contacts yet.</p>
          )}
          <ul className="mb-3">
            {contacts.map((c, i) => (
              <li key={i} className="border rounded-lg px-3 py-2 mb-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>
                    {c.name} · {c.phone}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeContact(i)}
                    className="text-red-600"
                  >
                    Remove
                  </button>
                </div>
                {!normalizePhone(c.phone) && (
                  <p className="text-xs text-amber-700 mt-1">
                    No country code: this contact will be skipped for text
                    alerts. Remove it and add it as +48...
                  </p>
                )}
              </li>
            ))}
          </ul>

          <input
            className="w-full border rounded-lg px-3 py-2 mb-2"
            placeholder="Name"
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 mb-2"
            placeholder="Phone (+48...)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <button
            type="button"
            onClick={addContact}
            className="w-full border rounded-lg py-2"
          >
            + Add contact
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <p className="font-bold mb-1">Data on this device</p>
          <p className="text-xs text-gray-500 mb-3">
            Your profile, contacts and run history live only in this browser.
            Deleting them also ends a run in progress. Your account stays.
          </p>
          <button
            type="button"
            onClick={deleteLocal}
            disabled={busy}
            className="w-full border border-red-300 text-red-700 rounded-xl py-2 text-sm disabled:opacity-60"
          >
            Delete data on this device
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate("/how-it-works")}
          className="w-full text-center text-sm underline text-gray-600"
        >
          How the safety score works
        </button>
      </div>
    </div>
  );
}