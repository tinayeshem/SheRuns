import { useEffect, useState } from "react";

export type Conditions = {
  temp: number;
  sunset: string; // "HH:MM"
  aqi: number;
  aqiLabel: string;
};

const LUBLIN = { lat: 51.2465, lng: 22.5684 };

function aqiLabel(aqi: number) {
  if (aqi <= 20) return "Good";
  if (aqi <= 40) return "Fair";
  if (aqi <= 60) return "Moderate";
  if (aqi <= 80) return "Poor";
  if (aqi <= 100) return "Very poor";
  return "Extremely poor";
}

export function useConditions() {
  const [data, setData] = useState<Conditions | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const { lat, lng } = LUBLIN;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&daily=sunset&timezone=auto`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi`;

    Promise.all([
      fetch(weatherUrl).then((r) => r.json()),
      fetch(airUrl).then((r) => r.json()),
    ])
      .then(([w, a]) => {
        const aqi = Math.round(a.current.european_aqi);
        setData({
          temp: Math.round(w.current.temperature_2m),
          sunset: w.daily.sunset[0].slice(11, 16),
          aqi,
          aqiLabel: aqiLabel(aqi),
        });
      })
      .catch(() => setError(true));
  }, []);

  return { data, error };
}