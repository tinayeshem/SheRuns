const TYPE_LABEL: Record<string, string> = {
  footway: "Footpath",
  path: "Path",
  pedestrian: "Pedestrian street",
  cycleway: "Cycle path",
  track: "Track",
  living_street: "Living street",
  residential: "Residential street",
  service: "Service road",
  unclassified: "Minor road",
  tertiary: "Tertiary road",
  secondary: "Secondary road",
  primary: "Main road",
};

export function streetLabel(name: string | null, highway: string | null) {
  if (name && name.trim()) return name;
  return TYPE_LABEL[highway ?? ""] ?? "Street";
}