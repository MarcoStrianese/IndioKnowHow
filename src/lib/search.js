// Ricerca: sul server quando online (più precisa), in locale quando offline.
import { supabase } from './supabase.js';
import { app } from './store.svelte.js';
import { plainText } from './markdown.js';

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function searchNotes(q) {
  q = (q || '').trim();
  if (!q) return [];
  if (navigator.onLine && supabase) {
    const { data, error } = await supabase.rpc('search_notes', { q, max_results: 40 });
    if (!error && data) return data.map((r) => ({ ...r, snippet: plainText(r.snippet, 200) }));
  }
  return localSearch(q);
}

export function localSearch(q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const out = [];
  for (const n of Object.values(app.notes)) {
    const head = norm(n.title + ' ' + (n.tags || []).join(' '));
    const body = norm(n.body);
    let score = 0;
    let ok = true;
    for (const t of terms) {
      const inHead = head.includes(t);
      const inBody = body.includes(t);
      if (!inHead && !inBody) { ok = false; break; }
      score += (inHead ? 5 : 0) + (inBody ? 1 : 0);
    }
    if (ok) out.push({ ...n, rank: score, snippet: plainText(n.body, 200) });
  }
  return out.sort((a, b) => b.rank - a.rank || b.updated_at.localeCompare(a.updated_at)).slice(0, 40);
}
