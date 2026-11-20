// Stato dell'app + copia locale delle note (IndexedDB) per consultarle anche offline.
import { get, set, clear } from 'idb-keyval';
import { supabase } from './supabase.js';

export const app = $state({
  session: null,
  notes: {},          // id -> nota
  members: {},        // email -> nome
  ready: false,
  syncing: false,
  online: navigator.onLine,
  lastSync: null,
  toast: null,
});

export const COLS =
  'id,title,body,tags,needs_review,created_by_email,updated_by_email,created_at,updated_at,deleted_at';

let toastTimer;
export function toast(msg, ms = 2800) {
  app.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (app.toast = null), ms);
}

export async function loadLocal() {
  try {
    app.notes = (await get('ikh-notes')) || {};
    app.members = (await get('ikh-members')) || {};
    app.lastSync = (await get('ikh-lastSync')) || null;
  } catch (e) {
    console.warn('IndexedDB non disponibile', e);
  }
  app.ready = true;
}

async function persist() {
  try {
    await set('ikh-notes', $state.snapshot(app.notes));
    await set('ikh-members', $state.snapshot(app.members));
    await set('ikh-lastSync', app.lastSync);
  } catch (e) {
    console.warn('Salvataggio locale non riuscito', e);
  }
}

export function mergeNote(n) {
  if (n.deleted_at) delete app.notes[n.id];
  else app.notes[n.id] = n;
}

let syncPromise = null;
export function sync() {
  if (!syncPromise) syncPromise = doSync().finally(() => (syncPromise = null));
  return syncPromise;
}

async function doSync() {
  if (!supabase || !app.session || !navigator.onLine) return;
  app.syncing = true;
  try {
    let since = app.lastSync || '1970-01-01T00:00:00Z';
    for (let guard = 0; guard < 200; guard++) {
      const { data, error } = await supabase
        .from('notes').select(COLS)
        .gte('updated_at', since)
        .order('updated_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      for (const n of data) mergeNote(n);
      const newSince = data.length ? data[data.length - 1].updated_at : since;
      if (data.length < 500 || newSince === since) { since = newSince; break; }
      since = newSince;
    }
    app.lastSync = since;

    const { data: mem } = await supabase.from('members').select('email,display_name');
    if (mem) app.members = Object.fromEntries(mem.map((m) => [m.email.toLowerCase(), m.display_name || m.email]));

    await persist();
  } catch (e) {
    console.error(e);
    toast('Sincronizzazione non riuscita: ' + (e.message || e));
  } finally {
    app.syncing = false;
  }
}

/** Salva (crea o aggiorna). Lancia un errore con .conflict=true se qualcuno ha modificato la nota nel frattempo. */
export async function saveNote(n, { force = false } = {}) {
  const payload = {
    title: (n.title || '').trim(),
    body: n.body || '',
    tags: n.tags || [],
    needs_review: !!n.needs_review,
  };
  let res;
  if (!n.id) {
    res = await supabase.from('notes').insert(payload).select(COLS);
  } else {
    let q = supabase.from('notes').update(payload).eq('id', n.id);
    if (!force && n.base_updated_at) q = q.eq('updated_at', n.base_updated_at);
    res = await q.select(COLS);
  }
  if (res.error) throw res.error;
  const row = res.data?.[0];
  if (!row) {
    const e = new Error('Conflitto di modifica');
    e.conflict = true;
    throw e;
  }
  mergeNote(row);
  await persist();
  return row;
}

export async function setDeleted(id, deleted) {
  const { data, error } = await supabase
    .from('notes')
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq('id', id)
    .select(COLS);
  if (error) throw error;
  if (data?.[0]) mergeNote(data[0]);
  await persist();
}

export async function fetchTrash() {
  const { data, error } = await supabase
    .from('notes').select(COLS)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function fetchVersions(noteId) {
  const { data, error } = await supabase
    .from('note_versions')
    .select('id,title,body,tags,edited_by_email,created_at')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase?.auth.signOut();
  try { await clear(); } catch {}
  localStorage.removeItem('ikh-signed');
  app.notes = {};
  app.members = {};
  app.lastSync = null;
}

export function authorName(email) {
  if (!email) return '—';
  const known = app.members[email.toLowerCase()];
  if (known) return known;
  // marco.strianese@... -> Marco Strianese
  return email.split('@')[0].split(/[._-]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** Elenco tag con conteggio, ordinati per frequenza. */
export function tagCounts() {
  const m = new Map();
  for (const n of Object.values(app.notes)) for (const t of n.tags || []) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
