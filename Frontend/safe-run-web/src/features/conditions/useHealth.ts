import { useEffect, useState } from "react";

export type IceRisk = "low" | "moderate" | "high";

export type Health = {
  temp: number;
  aqi: number;
  aqiLabel: string;
  pm25: number | null;
  ice: IceRisk;
  sunset: string;
  warnings: string[];
  cleanest: { time: string; aqi: number } | null;
};

const KRAKOW = { lat: 50.0647, lng: 19.945 };
const AHEAD = 12;

export function aqiLabel(aqi: number) {
  if (aqi <= 20) return "Good";
  if (aqi <= 40) return "Fair";
  if (aqi <= 60) return "Moderate";
  if (aqi <= 80) return "Poor";
  if (aqi <= 100) return "Very poor";
  return "Extremely poor";
}

function iceAt(t: number, precip: number, rh: number): IceRisk {
  if (t <= 0 && (precip > 0 || rh >= 85)) return "high";
  if (t <= 2) return "moderate";
  return "low";
}

const hhmm = (iso: string) => iso.slice(11, 16);
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export function useHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    const { lat, lng } = KRAKOW;
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m&hourly=temperature_2m,precipitation,relative_humidity_2m` +
      `&daily=sunset&forecast_days=2&timezone=auto`;
    const airUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
      `&current=european_aqi,pm2_5&hourly=european_aqi&forecast_days=2&timezone=auto`;

    const get = (url: string) =>
      fetch(url, { signal: c.signal }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      });

    Promise.all([get(weatherUrl), get(airUrl)])
      .then(([w, a]) => {
        const hourKey = String(w.current.time).slice(0, 13);
        const wTimes: string[] = w.hourly.time;
        const aTimes: string[] = a.hourly.time;
        const wi = Math.max(0, wTimes.findIndex((t) => t.slice(0, 13) === hourKey));
        const ai = Math.max(0, aTimes.findIndex((t) => t.slice(0, 13) === hourKey));

        const temp = Math.round(w.current.temperature_2m);
        const aqi = Math.round(a.current.european_aqi);
        const pm25 = num(a.current.pm2_5);

        const iceNext: { time: string; risk: IceRisk }[] = [];
        for (let i = wi; i < Math.min(wTimes.length, wi + AHEAD); i++) {
          const t = num(w.hourly.temperature_2m[i]);
          if (t === null) continue;
          iceNext.push({
            time: wTimes[i],
            risk: iceAt(
              t,
              num(w.hourly.precipitation[i]) ?? 0,
              num(w.hourly.relative_humidity_2m[i]) ?? 0
            ),
          });
        }
        const ice: IceRisk = iceNext[0]?.risk ?? iceAt(temp, 0, 0);

        const airNext: { time: string; aqi: number }[] = [];
        for (let i = ai; i < Math.min(aTimes.length, ai + AHEAD); i++) {
          const v = num(a.hourly.european_aqi[i]);
          if (v !== null) airNext.push({ time: aTimes[i], aqi: Math.round(v) });
        }

        const warnings: string[] = [];

        if (aqi > 60) {
          warnings.push("Air quality is poor right now. Prefer a shorter, easier run.");
        } else {
          const bad = airNext.find((x) => x.aqi > 60);
          if (bad) warnings.push(`Air quality gets poor around ${hhmm(bad.time)}.`);
        }

        if (ice === "high") {
          warnings.push("Ice is likely now. Slow down and avoid shaded paths and bridges.");
        } else {
          const soon = iceNext.find((x) => x.risk === "high");
          if (soon) {
            warnings.push(`Ice is possible on paths from ${hhmm(soon.time)}.`);
          } else if (ice === "moderate") {
            warnings.push("Near freezing. Watch for ice on bridges and shaded paths.");
          }
        }

        if (temp >= 30) {
          warnings.push("It is hot. Run early or late and carry water.");
        }

        let cleanest: Health["cleanest"] = null;
        if (airNext.length > 1) {
          const best = airNext.reduce((m, x) => (x.aqi < m.aqi ? x : m));
          if (best.aqi <= aqi - 10) {
            cleanest = { time: hhmm(best.time), aqi: best.aqi };
          }
        }

        setData({
          temp,
          aqi,
          aqiLabel: aqiLabel(aqi),
          pm25,
          ice,
          sunset: String(w.daily.sunset[0]).slice(11, 16),
          warnings,
          cleanest,
        });
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError(true);
      });

    return () => c.abort();
  }, []);

  return { data, error };
}