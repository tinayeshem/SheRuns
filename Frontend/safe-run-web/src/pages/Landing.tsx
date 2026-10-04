import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");

.lp { min-height: 100vh; background: #05030d; color: #fff; overflow-x: hidden;
  font-family: "Plus Jakarta Sans", "Century Gothic", Futura, system-ui, sans-serif; }
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp button { font-family: inherit; cursor: pointer; }
.lp a { color: inherit; text-decoration: none; }

/* nav */
.lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; transition: background .3s, border-color .3s;
  border-bottom: 1px solid transparent; }
.lp-nav.solid { background: rgba(5,3,13,.82); backdrop-filter: blur(12px); border-color: rgba(255,255,255,.08); }
.lp-nav-in { max-width: 1280px; margin: 0 auto; padding: 22px clamp(20px, 5vw, 56px);
  display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.lp-logo { display: inline-flex; align-items: center; gap: 12px; background: none; border: 0; color: #fff; padding: 0; }
.lp-logo b { font-size: 17px; font-weight: 800; letter-spacing: .06em; line-height: 1.05; text-align: left; }
.lp-links { display: flex; gap: clamp(20px, 3vw, 42px); }
.lp-links button, .lp-links a { background: none; border: 0; color: #fff; font-size: 11px; font-weight: 700;
  letter-spacing: .12em; text-transform: uppercase; padding: 6px 0; opacity: .85; transition: opacity .2s; }
.lp-links button:hover, .lp-links a:hover { opacity: 1; }
.lp-signin { background: #6d1fe8; border: 0; color: #fff; border-radius: 999px; padding: 12px 34px;
  font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  box-shadow: 0 10px 30px -10px rgba(109,31,232,.9); transition: transform .2s, filter .2s; }
.lp-signin:hover { transform: translateY(-2px); filter: brightness(1.12); }

/* hero */
.lp-hero { position: relative; min-height: 100vh; display: flex; align-items: center; overflow: hidden; }
.lp-glow { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
.lp-glow.a { width: 460px; height: 460px; left: -140px; top: -120px; background: rgba(109,31,232,.35); animation: lp-drift 18s ease-in-out infinite; }
.lp-glow.b { width: 520px; height: 520px; right: -160px; bottom: -120px; background: rgba(79,70,229,.28); animation: lp-drift 26s ease-in-out infinite reverse; }
.lp-art { position: absolute; right: -6%; top: 50%; width: min(66vw, 960px); transform: translateY(-50%); pointer-events: none; opacity: .95; }
.lp-art .breathe { transform-box: fill-box; transform-origin: center; animation: lp-breathe 10s ease-in-out infinite; }
.lp-art .ring { transform-box: fill-box; transform-origin: center; animation: lp-spin var(--dur, 60s) linear infinite var(--dir, normal); }

.lp-copy { position: relative; z-index: 2; width: 100%; padding: 110px clamp(24px, 8vw, 130px) 90px; }
.lp-eyebrow { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: #c4b5fd; margin-bottom: 18px; }
.lp-h1 { margin: 0; font-size: clamp(64px, 12vw, 168px); line-height: .95; font-weight: 700; letter-spacing: -.035em; color: #f4f2f8; }
.lp-tag { margin: 22px 0 0; font-size: clamp(17px, 2vw, 22px); color: rgba(255,255,255,.72); max-width: 480px; line-height: 1.5; }

.lp-search { margin-top: 38px; width: min(440px, 100%); height: 58px; border: 1.5px solid rgba(255,255,255,.75);
  border-radius: 999px; background: transparent; color: rgba(255,255,255,.6); display: flex; align-items: center;
  justify-content: space-between; padding: 0 24px; font-size: 15px; text-align: left; transition: background .25s, border-color .25s, color .25s; }
.lp-search:hover { background: rgba(255,255,255,.08); border-color: #fff; color: #fff; }
.lp-actions { margin-top: 26px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
.lp-btn { border-radius: 999px; padding: 14px 32px; font-size: 12px; font-weight: 800; letter-spacing: .14em;
  text-transform: uppercase; border: 1.5px solid transparent; transition: transform .2s, filter .2s, background .2s; }
.lp-btn.fill { background: #3b82f6; color: #fff; box-shadow: 0 12px 30px -10px rgba(59,130,246,.9); }
.lp-btn.fill:hover { transform: translateY(-2px); filter: brightness(1.1); }
.lp-btn.line { background: transparent; color: #fff; border-color: rgba(255,255,255,.55); font-weight: 600; letter-spacing: .08em; text-transform: none; font-size: 14px; }
.lp-btn.line:hover { background: rgba(255,255,255,.1); }
.lp-guest { margin-top: 18px; background: none; border: 0; color: rgba(255,255,255,.6); font-size: 13px; text-decoration: underline; padding: 0; }
.lp-guest:hover { color: #fff; }

.lp-center { position: absolute; z-index: 2; right: clamp(24px, 9vw, 150px); top: 38%; width: 290px; text-align: center; }
.lp-center h2 { margin: 14px 0 0; font-size: 34px; font-weight: 400; letter-spacing: -.01em; color: #ede9fe; }
.lp-center p { margin: 14px auto 0; font-size: 11px; line-height: 1.7; color: rgba(255,255,255,.78); max-width: 250px; }

.lp-mouse { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); width: 20px; height: 32px;
  border: 1.5px solid rgba(255,255,255,.65); border-radius: 12px; z-index: 2; background: none; padding: 0; }
.lp-mouse::after { content: ""; position: absolute; left: 50%; top: 6px; width: 3px; height: 7px; margin-left: -1.5px;
  border-radius: 3px; background: #fff; animation: lp-wheel 1.8s ease-in-out infinite; }

/* sections */
.lp-sec { padding: clamp(64px, 9vw, 120px) clamp(20px, 5vw, 56px); }
.lp-in { max-width: 1180px; margin: 0 auto; }
.lp-k { font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #a78bfa; }
.lp-title { margin: 10px 0 0; font-size: clamp(28px, 4vw, 46px); font-weight: 800; letter-spacing: -.02em; max-width: 640px; line-height: 1.1; }
.lp-grid { display: grid; gap: 18px; margin-top: 44px; }
.lp-grid.c3 { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.lp-grid.c4 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.lp-card { height: 100%; border-radius: 26px; padding: 28px; background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1); transition: transform .3s, border-color .3s, background .3s; }
.lp-card:hover { transform: translateY(-6px); border-color: rgba(167,139,250,.55); background: rgba(255,255,255,.06); }
.lp-num { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-weight: 800;
  background: linear-gradient(135deg, #8b5cf6, #4f46e5); }
.lp-card h3 { margin: 18px 0 0; font-size: 19px; font-weight: 700; }
.lp-card p { margin: 10px 0 0; font-size: 14px; line-height: 1.65; color: rgba(255,255,255,.66); }
.lp-big { font-size: 56px; font-weight: 800; line-height: 1; background: linear-gradient(90deg, #c4b5fd, #818cf8);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.lp-src { margin-top: 14px !important; font-size: 12px !important; color: rgba(255,255,255,.4) !important; }
.lp-note { margin-top: 22px; font-size: 12px; color: rgba(255,255,255,.42); }

.lp-cta { position: relative; overflow: hidden; max-width: 940px; margin: 0 auto; border-radius: 32px; text-align: center;
  padding: clamp(40px, 7vw, 80px) 24px; background: linear-gradient(135deg, #5b21b6 0%, #3b0f8c 50%, #1e1b4b 100%); }
.lp-cta h2 { position: relative; margin: 0; font-size: clamp(26px, 4vw, 42px); font-weight: 800; letter-spacing: -.02em; }
.lp-cta p { position: relative; margin: 14px auto 0; max-width: 460px; color: rgba(255,255,255,.78); }
.lp-cta .lp-actions { position: relative; justify-content: center; margin-top: 30px; }
.lp-cta .lp-btn.fill { background: #fff; color: #3b0f8c; box-shadow: none; }

.lp-foot { border-top: 1px solid rgba(255,255,255,.1); padding: 34px 20px; text-align: center; color: rgba(255,255,255,.5); font-size: 12px; }
.lp-foot nav { display: flex; gap: 26px; justify-content: center; margin-bottom: 12px; flex-wrap: wrap; }
.lp-foot button { background: none; border: 0; color: rgba(255,255,255,.6); font-size: 13px; padding: 0; }
.lp-foot button:hover { color: #fff; }

.lp-rv { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.8,.2,1); }
.lp-rv.in { opacity: 1; transform: none; }
.lp-up { animation: lp-up .9s cubic-bezier(.2,.8,.2,1) both; animation-delay: var(--d, 0ms); }

@keyframes lp-up { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
@keyframes lp-spin { to { transform: rotate(360deg); } }
@keyframes lp-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@keyframes lp-drift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,30px) scale(1.12); } }
@keyframes lp-wheel { 0% { opacity: 0; transform: translateY(0); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(10px); } }
@keyframes lp-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.lp-float { animation: lp-float 6s ease-in-out infinite; }

@media (max-width: 1000px) { .lp-center { display: none; } .lp-art { opacity: .5; right: -22%; width: 110vw; } }
@media (max-width: 760px) { .lp-links { display: none; } .lp-signin { padding: 11px 24px; } }
@media (prefers-reduced-motion: reduce) {
  .lp *, .lp *::before, .lp *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
`;

function ringPath(r: number, k: number, seed: number) {
  const N = 120;
  const parts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob =
      1 +
      0.09 * Math.sin(3 * a + seed + k * 0.35) +
      0.06 * Math.sin(5 * a - seed * 1.7 + k * 0.2) +
      0.03 * Math.sin(7 * a + k);
    const x = 300 + Math.cos(a) * r * wob;
    const y = 300 + Math.sin(a) * r * 0.86 * wob;
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(" ") + "Z";
}

function Contours({ className = "", rings = 18, seed = 1 }: { className?: string; rings?: number; seed?: number }) {
  const gid = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const paths = useMemo(
    () =>
      Array.from({ length: rings }, (_, i) => ({
        d: ringPath(34 + i * (255 / rings), i, seed),
        dur: 50 + ((i * 7) % 5) * 14,
        rev: i % 2 === 1,
        op: 0.95 - (i / rings) * 0.6,
      })),
    [rings, seed]
  );
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden="true" fill="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <g className="breathe">
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            className="ring"
            stroke={`url(#${gid})`}
            strokeWidth={1.5}
            strokeOpacity={p.op}
            style={{ ["--dur" as string]: `${p.dur}s`, ["--dir" as string]: p.rev ? "reverse" : "normal" }}
          />
        ))}
      </g>
    </svg>
  );
}

function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="15" stroke="#c4b5fd" strokeWidth="3.5" />
      <path d="M16 13.5 L28 20 L16 26.5 Z" fill="#fff" />
    </svg>
  );
}

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lp-rv ${shown ? "in" : ""}`} style={{ transitionDelay: `${delay}ms`, height: "100%" }}>
      {children}
    </div>
  );
}

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVal(to);
      return;
    }
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1600);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return <span ref={ref}>{val}%</span>;
}

const STEPS = [
  { t: "Tell us how you run", x: "Alone, at night, with a dog, as a beginner. It takes 20 seconds." },
  { t: "Choose a loop and a time", x: "Every street piece is scored for the hour you pick. Weak stretches are shown, not hidden." },
  { t: "Run with a safety net", x: "Share a live link, set a finish time, and your contacts are warned if you are late." },
];

const FEATURES = [
  { t: "Time-aware scores", x: "The same park path can be fine at 14:00 and risky at 22:00. Scores follow the hour and the sunset." },
  { t: "Made for how you run", x: "Running alone, at night, with a dog or with low vision? Your profile changes what counts most." },
  { t: "Safer loops, instantly", x: "Pick a distance and get loops that avoid weak stretches, with a safe window for each." },
  { t: "Community reports", x: "Runners flag broken lights, ice and harassment. Reports fade unless someone confirms them." },
  { t: "Health aware", x: "Air quality, ice risk and a how-do-you-feel check suggest an easier loop when you are tired." },
  { t: "A live safety net", x: "Share a live link that expires, set a check-in time, and call 112 with one tap." },
];

const STATS = [
  { to: 92, x: "of women runners are concerned about their safety outdoors", s: "Adidas survey, 9,000 runners" },
  { to: 60, x: "of women runners have been harassed while running", s: "Runner's World and Women's Health, 2021" },
  { to: 11, x: "stopped running because of harassment", s: "Runner's World and Women's Health, 2021" },
  { to: 31, x: "of adults worldwide do not get enough physical activity", s: "World Health Organization" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const f = () => setSolid(window.scrollY > 12);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="lp">
      <style>{CSS}</style>

      <header className={`lp-nav ${solid ? "solid" : ""}`}>
        <div className="lp-nav-in">
          <button type="button" className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <LogoMark />
            <b>SAFE<br />RUN</b>
          </button>
          <nav className="lp-links" aria-label="Main">
            <button type="button" onClick={() => go("how")}>How it works</button>
            <button type="button" onClick={() => go("features")}>Features</button>
            <button type="button" onClick={() => go("proof")}>Why it matters</button>
            <button type="button" onClick={() => navigate("/how-it-works")}>Scores</button>
            <button type="button" onClick={() => navigate("/home")}>Map</button>
          </nav>
          <button type="button" className="lp-signin" onClick={() => navigate("/login")}>Sign in</button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-glow a" />
        <div className="lp-glow b" />
        <Contours className="lp-art" />

        <div className="lp-copy">
          <span className="lp-eyebrow lp-up" style={{ ["--d" as string]: "0ms" }}>
            Safety scores that change with the time of day
          </span>
          <h1 className="lp-h1 lp-up" style={{ ["--d" as string]: "120ms" }}>Welcome.</h1>
          <p className="lp-tag lp-up" style={{ ["--d" as string]: "260ms" }}>
            Run where it feels safe. Every street gets a score from 0 to 100, for the hour you run.
          </p>

          <button
            type="button"
            className="lp-search lp-up"
            style={{ ["--d" as string]: "380ms" }}
            onClick={() => navigate("/plan?run=1")}
          >
            <span>Find the safest loop near you</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
          </button>

          <div className="lp-actions lp-up" style={{ ["--d" as string]: "480ms" }}>
            <button type="button" className="lp-btn fill" onClick={() => navigate("/signup")}>Get started</button>
            <button type="button" className="lp-btn line" onClick={() => go("how")}>see more</button>
          </div>
          <button type="button" className="lp-guest lp-up" style={{ ["--d" as string]: "560ms" }} onClick={() => navigate("/home")}>
            or try the map as a guest
          </button>
        </div>

        <div className="lp-center lp-up" style={{ ["--d" as string]: "600ms" }}>
          <div className="lp-float"><LogoMark size={56} /></div>
          <h2>Safe routes.</h2>
          <p>
            Lighting, isolation, traffic, surface and reports are combined into one score for
            every street, then checked again for the hour and your running profile.
          </p>
        </div>

        <button type="button" className="lp-mouse" aria-label="Scroll down" onClick={() => go("how")} />
      </section>

      <section id="how" className="lp-sec">
        <div className="lp-in">
          <Reveal>
            <span className="lp-k">How it works</span>
            <h2 className="lp-title">From worry to a plan in three steps</h2>
          </Reveal>
          <div className="lp-grid c3">
            {STEPS.map((s, i) => (
              <Reveal key={s.t} delay={i * 120}>
                <div className="lp-card">
                  <span className="lp-num">{i + 1}</span>
                  <h3>{s.t}</h3>
                  <p>{s.x}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="lp-sec">
        <div className="lp-in">
          <Reveal>
            <span className="lp-k">Features</span>
            <h2 className="lp-title">Built around the run, not just the map</h2>
          </Reveal>
          <div className="lp-grid c3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.t} delay={(i % 3) * 100}>
                <div className="lp-card">
                  <h3 style={{ marginTop: 0 }}>{f.t}</h3>
                  <p>{f.x}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="proof" className="lp-sec">
        <div className="lp-in">
          <Reveal>
            <span className="lp-k">Why it matters</span>
            <h2 className="lp-title">Fear should not decide where you run</h2>
          </Reveal>
          <div className="lp-grid c4">
            {STATS.map((s, i) => (
              <Reveal key={s.x} delay={i * 100}>
                <div className="lp-card">
                  <div className="lp-big"><CountUp to={s.to} /></div>
                  <p style={{ color: "rgba(255,255,255,.85)" }}>{s.x}</p>
                  <p className="lp-src">{s.s}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="lp-note">
            Survey results are self-reported and mostly from the UK, the US and other countries, not from Poland.
          </p>
        </div>
      </section>

      <section className="lp-sec" style={{ paddingTop: 20 }}>
        <Reveal>
          <div className="lp-cta">
            <Contours className="" rings={12} seed={3} />
            <style>{`.lp-cta > svg { position: absolute; right: -140px; top: -140px; width: 520px; opacity: .4; pointer-events: none; }`}</style>
            <h2>Your next run, planned for the hour you run</h2>
            <p>Create a free account to report problems and share live runs, or look around as a guest first.</p>
            <div className="lp-actions">
              <button type="button" className="lp-btn fill" onClick={() => navigate("/signup")}>Create an account</button>
              <button type="button" className="lp-btn line" onClick={() => navigate("/home")}>Open the map</button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="lp-foot">
        <nav>
          <button type="button" onClick={() => navigate("/how-it-works")}>How the safety score works</button>
          <button type="button" onClick={() => navigate("/login")}>Log in</button>
          <button type="button" onClick={() => navigate("/home")}>Map</button>
        </nav>
        <p>
          Map data from OpenStreetMap contributors. Scores are estimates, not a guarantee of safety.
          Use your own judgment.
        </p>
      </footer>
    </div>
  );
}