export type ReportType = { key: string; label: string };

export const REPORT_TYPES: ReportType[] = [
  { key: "broken_light", label: "Broken light" },
  { key: "harassment", label: "Harassment" },
  { key: "ice", label: "Ice" },
  { key: "aggressive_dog", label: "Aggressive dog" },
  { key: "flooding", label: "Flooding" },
  { key: "construction", label: "Construction" },
  { key: "poor_visibility", label: "Poor visibility" },
];

export type Report = {
  id: string;
  type: string;
  label: string;
  note: string | null;
  confirmations: number;
  goneVotes: number;
  status: "pending" | "approved" | "removed";
  lng: number;
  lat: number;
  createdAt: string;
  lastConfirmedAt: string;
  expiresAt: string;
};

export type AdminReport = Report & { device: string | null };