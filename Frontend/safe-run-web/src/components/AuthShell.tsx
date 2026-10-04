import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Share2, ShieldCheck, UserCheck } from "lucide-react";
import Logo from "./Logo";


const POINTS = [
  { icon: ShieldCheck, text: "Scores that change with the time of day" },
  { icon: UserCheck, text: "Made for how you run" },
  { icon: Share2, text: "A live safety net for every run" },
];

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="grad-aside relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex">
        <img src="../../public/filip-mroz-XCkRGOX2VgM-unsplash.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
<div
  className="absolute inset-0"
  style={{
    background:
      "linear-gradient(180deg, rgba(46,16,101,.72) 0%, rgba(46,16,101,.35) 45%, rgba(30,27,75,.85) 100%)",
  }}
/>
        <Link to="/" className="relative">
          <Logo tone="light" />
        </Link>
        <div className="relative max-w-sm">
          <h2 className="text-4xl font-extrabold leading-tight">Run where it feels safe.</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/85">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
                  <Icon size={18} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Map data © OpenStreetMap contributors.</p>
      </aside>

      <main className="page-bg flex items-center justify-center px-4 py-10">
        <div className="animate-fade-up w-full max-w-md rounded-3xl bg-white p-7 shadow-xl shadow-brand-900/10 sm:p-9">
          <Link to="/" className="mb-6 inline-block md:hidden">
            <Logo />
          </Link>
          <h1 className="text-2xl font-extrabold text-brand-950">{title}</h1>
          {subtitle && <p className="mt-1 mb-6 text-sm text-gray-500">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}
          {children}
          {footer && <div className="mt-6 text-center text-sm text-gray-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}