// Operazioni di testo sull'area di scrittura (textarea) dell'editor.
// Ogni funzione aggiorna doc.body e riposiziona il cursore.

// Il valore va scritto subito nella textarea (non al frame successivo),
// altrimenti chi scrive veloce si ritrova le lettere nel punto sbagliato.
function apply(ta, doc, start, end, insert, selFrom, selTo, focus = false) {
  const value = doc.body.slice(0, start) + insert + doc.body.slice(end);
  if (ta) {
    ta.value = value;
    if (focus) ta.focus();
    ta.setSelectionRange(selFrom, selTo ?? selFrom);
  }
  doc.body = value;
}

export function insertText(ta, doc, text, at = null) {
  const s = at ?? ta?.selectionStart ?? doc.body.length;
  const e = at ?? ta?.selectionEnd ?? doc.body.length;
  if (!ta) { doc.body = doc.body.slice(0, s) + text + doc.body.slice(e); return; }
  apply(ta, doc, s, e, text, s + text.length);
}

/** Inserisce un blocco su righe proprie (immagini, tabelle, callout). */
export function insertBlock(ta, doc, text, at = null) {
  const s = at ?? ta?.selectionStart ?? doc.body.length;
  const before = doc.body.slice(0, s);
  const pre = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  insertText(ta, doc, pre + text + '\n\n', at);
}

export function wrap(ta, doc, left, right = left, placeholder = 'testo') {
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = doc.body.slice(s, e) || placeholder;
  apply(ta, doc, s, e, left + sel + right, s + left.length, s + left.length + sel.length, true);
}

/** Aggiunge o toglie un prefisso a ogni riga selezionata (titoli, elenchi, citazioni). */
export function prefixLines(ta, doc, prefix) {
  const s = ta.selectionStart, e = ta.selectionEnd;
  const lineStart = doc.body.lastIndexOf('\n', s - 1) + 1;
  let lineEnd = doc.body.indexOf('\n', e);
  if (lineEnd === -1) lineEnd = doc.body.length;
  const lines = doc.body.slice(lineStart, lineEnd).split('\n');
  const all = lines.every((l) => l.startsWith(prefix));
  const out = lines
    .map((l, i) => {
      const p = prefix === '1. ' ? `${i + 1}. ` : prefix;
      if (all) return l.slice(prefix.length);
      return p + l.replace(/^(#{1,6}\s|[-*+]\s(\[[ x]\]\s)?|\d+\.\s|>\s)/, '');
    })
    .join('\n');
  apply(ta, doc, lineStart, lineEnd, out, lineStart + out.length, null, true);
}

/** Invio dentro un elenco: continua l'elenco; su voce vuota la chiude. Restituisce true se gestito. */
export function handleEnter(ta, doc) {
  const s = ta.selectionStart;
  if (s !== ta.selectionEnd) return false;
  const lineStart = doc.body.lastIndexOf('\n', s - 1) + 1;
  const line = doc.body.slice(lineStart, s);
  const m = line.match(/^(\s*)([-*+]|(\d+)\.)\s(\[[ xX]\]\s)?/);
  if (!m) return false;
  if (line.trim() === m[0].trim()) {
    apply(ta, doc, lineStart, s, '', lineStart);
    return true;
  }
  const bullet = m[3] ? `${Number(m[3]) + 1}.` : m[2];
  const next = `\n${m[1]}${bullet} ${m[4] ? '[ ] ' : ''}`;
  apply(ta, doc, s, s, next, s + next.length);
  return true;
}

export const TABLE = '| Colonna 1 | Colonna 2 |\n| --- | --- |\n| valore | valore |';
export const callout = (type) => `> [!${type}]\n> `;

export function normalizeTag(t) {
  return t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
}

/** Percorsi delle immagini presenti nel testo (storage:...). */
export function storageImages(body) {
  return [...(body || '').matchAll(/!\[[^\]]*\]\(storage:([^)\s]+)[^)]*\)/g)].map((m) => m[1]);
}
