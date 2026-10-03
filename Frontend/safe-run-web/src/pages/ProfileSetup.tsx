import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useProfileStore,
  type Contact,
  type RouteMode,
} from "../store/profileStore";

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

export default function ProfileSetup() {
  const navigate = useNavigate();
  const saveProfile = useProfileStore((s) => s.saveProfile);
  const initial = useProfileStore.getState();

  const [step, setStep] = useState(1);
  const [traits, setTraits] = useState<string[]>(initial.traits);
  const [mode, setMode] = useState<RouteMode>(initial.routeMode);
  const [contacts, setContacts] = useState<Contact[]>(initial.contacts);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const toggleTrait = (key: string) =>
    setTraits((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );

  const addContact = () => {
    if (!name.trim() || !phone.trim()) return;
    setContacts((prev) => [...prev, { name: name.trim(), phone: phone.trim() }]);
    setName("");
    setPhone("");
  };

  const removeContact = (index: number) =>
    setContacts((prev) => prev.filter((_, i) => i !== index));

  const finish = () => {
    saveProfile({ traits, routeMode: mode, contacts });
    navigate("/home");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
        <p className="text-xs text-gray-500 mb-2">Step {step} of 3</p>
        <div className="h-1 bg-gray-200 rounded mb-6">
          <div
            className="h-1 bg-green-600 rounded transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {step === 1 && (
          <div>
            <h1 className="text-xl font-bold mb-4">How do you run?</h1>
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
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-xl font-bold mb-4">Route mode</h1>
            <div className="space-y-2">
              {MODES.map((m) => (
                <label key={m.key} className="flex items-center gap-3 border rounded-lg px-3 py-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === m.key}
                    onChange={() => setMode(m.key)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-xl font-bold mb-1">Trusted contacts</h1>
            <p className="text-sm text-gray-500 mb-4">Optional. You can add them later.</p>

            <ul className="space-y-2 mb-4">
              {contacts.map((c, i) => (
                <li key={i} className="flex justify-between items-center border rounded-lg px-3 py-2 text-sm">
                  <span>{c.name} · {c.phone}</span>
                  <button type="button" className="text-red-600" onClick={() => removeContact(i)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <input
              className="w-full border rounded-lg px-3 py-2 mb-2"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 mb-2"
              placeholder="Phone (+48...)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              type="button"
              className="w-full border rounded-lg py-2"
              onClick={addContact}
            >
              + Add contact
            </button>
          </div>
        )}

        <div className="flex gap-2 mt-6">
          {step > 1 && (
            <button
              type="button"
              className="flex-1 border rounded-lg py-2"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="flex-1 bg-green-600 text-white rounded-lg py-2"
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="flex-1 bg-green-600 text-white rounded-lg py-2"
              onClick={finish}
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}