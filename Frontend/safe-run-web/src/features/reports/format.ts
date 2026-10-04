export function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function expiresIn(iso: string) {
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 3600000);
  if (h <= 0) return "expires soon";
  if (h < 48) return `expires in ${h} h`;
  return `expires in ${Math.round(h / 24)} days`;
}