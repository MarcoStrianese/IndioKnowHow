// Immagini: compressione nel browser, upload nel bucket privato, URL firmati con cache.
import { supabase, BUCKET } from './supabase.js';

const MAX_SIDE = 1920;
const SIGN_SECONDS = 7 * 24 * 3600;
const CACHE_KEY = 'ikh-signed';

let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { cache = {}; }

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((res) => canvas.toBlob(res, type, quality));
}

/**
 * Ridimensiona e ricomprime. Ridisegnare su canvas elimina anche i metadati EXIF
 * (compresa la posizione GPS delle foto del telefono) e corregge la rotazione.
 */
export async function prepareImage(file) {
  if (file.type === 'image/gif') return { blob: file, ext: 'gif' };
  if (file.type === 'image/png' && file.size < 1.5e6) return { blob: file, ext: 'png' }; // screenshot nitidi

  const src = await decode(file);
  const w = src.width, h = src.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  src.close?.();

  if (file.type === 'image/png') {
    const webp = await toBlob(canvas, 'image/webp', 0.9);
    if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' };
  }
  const jpg = await toBlob(canvas, 'image/jpeg', 0.82);
  return { blob: jpg, ext: 'jpg' };
}

/** Carica l'immagine e restituisce il percorso da usare nel markdown come storage:<percorso>. */
export async function uploadImage(file) {
  const { blob, ext } = await prepareImage(file);
  const d = new Date();
  const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
  });
  if (error) throw error;
  return path;
}

/** Restituisce { percorso: url } riusando gli URL firmati in cache (così il service worker li ritrova offline). */
export async function signedUrls(paths) {
  const now = Date.now();
  const unique = [...new Set(paths)];
  const need = unique.filter((p) => !cache[p] || cache[p].exp < now + 24 * 3600 * 1000);
  if (need.length && supabase && navigator.onLine) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(need, SIGN_SECONDS);
    if (!error && data) {
      for (const d of data) {
        if (d.signedUrl && d.path) cache[d.path] = { url: d.signedUrl, exp: now + SIGN_SECONDS * 1000 };
      }
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
    }
  }
  return Object.fromEntries(unique.map((p) => [p, cache[p]?.url || null]));
}

/** Sostituisce le <img data-storage> dentro un elemento con gli URL reali. */
export async function resolveImages(root) {
  const imgs = [...root.querySelectorAll('img[data-storage]')];
  if (!imgs.length) return;
  const urls = await signedUrls(imgs.map((i) => i.dataset.storage));
  for (const img of imgs) {
    const u = urls[img.dataset.storage];
    if (u) img.src = u;
    else img.classList.add('img-missing');
  }
}
