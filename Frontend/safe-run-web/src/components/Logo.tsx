import { ShieldCheck } from "lucide-react";

export default function Logo({ tone = "dark" }: { tone?: "light" | "dark" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl grad-brand text-white shadow-lg shadow-brand-600/40">
        <ShieldCheck size={20} aria-hidden="true" />
      </span>
      <span
        className={`text-lg font-bold tracking-tight ${
          tone === "light" ? "text-white" : "text-brand-950"
        }`}
      >
        Safe Run
      </span>
    </span>
  );
}