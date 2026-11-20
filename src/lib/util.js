export const isMobileDevice = () =>
  window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900;

export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'adesso';
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} g fa`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fullDate(iso) {
  return iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

// Bozze salvate automaticamente sul dispositivo
const key = (id) => 'ikh-draft:' + (id || 'new');
export const drafts = {
  load(id) {
    try { return JSON.parse(localStorage.getItem(key(id)) || 'null'); } catch { return null; }
  },
  save(id, d) {
    try { localStorage.setItem(key(id), JSON.stringify({ ...d, savedAt: new Date().toISOString() })); } catch {}
  },
  clear(id) { localStorage.removeItem(key(id)); },
};
