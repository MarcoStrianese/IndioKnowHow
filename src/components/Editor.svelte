<script>
  import { untrack } from 'svelte';
  import { app, saveNote, toast } from '../lib/store.svelte.js';
  import { go } from '../lib/router.svelte.js';
  import { uploadImage } from '../lib/images.js';
  import { parseMarkdownFile } from '../lib/markdown.js';
  import { insertBlock, normalizeTag } from '../lib/editing.js';
  import { isMobileDevice, drafts, timeAgo } from '../lib/util.js';
  import EditorDesktop from './EditorDesktop.svelte';
  import EditorMobile from './EditorMobile.svelte';

  let { id = null, quick = false } = $props();

  // Il componente viene ricreato a ogni cambio di nota: qui servono solo i valori iniziali.
  const { noteId, isQuick } = untrack(() => ({ noteId: id, isQuick: quick }));
  const existing = noteId ? app.notes[noteId] : null;
  const original = {
    title: existing?.title ?? '',
    body: existing?.body ?? '',
    tags: [...(existing?.tags ?? [])],
    needs_review: existing ? existing.needs_review : isQuick,
  };
  const base_updated_at = existing?.updated_at;

  // Recupero bozza non salvata
  const draft = drafts.load(noteId);
  const useDraft = !!draft && (draft.body !== original.body || draft.title !== original.title);

  let doc = $state(useDraft
    ? { title: draft.title || '', body: draft.body || '', tags: draft.tags || [], needs_review: !!draft.needs_review }
    : structuredClone(original));
  let mode = $state(isQuick || isMobileDevice() ? 'mobile' : 'desktop');
  let saving = $state(false);
  let uploading = $state(0);
  let draftNotice = $state(useDraft ? draft.savedAt : null);

  const dirty = $derived(JSON.stringify(doc) !== JSON.stringify(original));

  // Salvataggio automatico della bozza sul dispositivo
  let draftTimer;
  $effect(() => {
    const snap = JSON.stringify(doc);
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (dirty) drafts.save(noteId, JSON.parse(snap));
      else drafts.clear(noteId);
    }, 500);
    return () => clearTimeout(draftTimer);
  });

  function discardDraft() {
    drafts.clear(noteId);
    Object.assign(doc, structuredClone(original));
    draftNotice = null;
  }

  async function save(force = false) {
    if (!doc.title.trim() && !doc.body.trim()) return toast('La nota è vuota');
    if (uploading) return toast('Attendi il caricamento delle immagini…');
    saving = true;
    try {
      const row = await saveNote({ id: noteId, ...doc, base_updated_at }, { force });
      drafts.clear(noteId);
      toast('Salvato ✓');
      go('/n/' + row.id, { replace: !noteId });
    } catch (e) {
      if (e.conflict) {
        if (confirm('Qualcuno ha modificato questa nota mentre la scrivevi.\n\nVuoi sovrascrivere? La sua versione resta comunque nella cronologia.')) {
          saving = false;
          return save(true);
        }
      } else if (!navigator.onLine) {
        toast('Sei offline: la bozza resta salvata sul dispositivo. Salva quando torni online.', 5000);
      } else {
        toast('Errore nel salvataggio: ' + (e.message || e), 5000);
      }
    } finally {
      saving = false;
    }
  }

  function cancel() {
    if (dirty && !confirm('Scartare le modifiche non salvate?')) return;
    drafts.clear(noteId);
    if (history.length > 1) history.back();
    else go(noteId ? '/n/' + noteId : '/');
  }

  /** Carica immagini e le inserisce nel testo nel punto del cursore. */
  async function addImages(files, ta) {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    if (!navigator.onLine) return toast('Offline: le immagini si possono caricare solo con la connessione');
    let at = ta ? ta.selectionStart : doc.body.length;
    for (const f of imgs) {
      uploading++;
      try {
        const path = await uploadImage(f);
        const before = doc.body.length;
        insertBlock(ta, doc, `![](storage:${path})`, at);
        at += doc.body.length - before;
      } catch (e) {
        toast('Caricamento immagine non riuscito: ' + (e.message || e), 5000);
      } finally {
        uploading--;
      }
    }
  }

  /** Importa un .md (con eventuali immagini trascinate insieme). */
  async function importFiles(files, ta) {
    files = [...files];
    const mdFile = files.find((f) => /\.(md|markdown|txt)$/i.test(f.name));
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!mdFile) return addImages(imgs, ta);
    if (doc.body.trim() && !confirm(`Sostituire il contenuto attuale con "${mdFile.name}"?`)) return;

    const parsed = parseMarkdownFile(await mdFile.text(), mdFile.name);
    let body = parsed.body;
    const byName = new Map(imgs.map((f) => [f.name.toLowerCase(), f]));
    let missing = 0;
    uploading++;
    try {
      const refs = [
        ...body.matchAll(/!\[([^\]]*)\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g),
        ...body.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g), // stile Obsidian
      ];
      for (const m of refs) {
        const isWiki = m[0].startsWith('![[');
        const href = isWiki ? m[1] : m[2];
        if (/^(https?:|storage:|data:)/i.test(href)) continue;
        const name = decodeURIComponent(href.split(/[\\/]/).pop()).toLowerCase();
        const f = byName.get(name);
        if (!f) { missing++; continue; }
        const path = await uploadImage(f);
        body = body.split(m[0]).join(`![${isWiki ? '' : m[1]}](storage:${path})`);
      }
    } catch (e) {
      toast('Errore durante l\'import delle immagini: ' + (e.message || e), 5000);
    } finally {
      uploading--;
    }
    doc.title = parsed.title || doc.title;
    doc.body = body;
    doc.tags = [...new Set([...doc.tags, ...parsed.tags.map(normalizeTag)])];
    toast(missing
      ? `Importato. ${missing} immagini locali non trovate: trascinale insieme al file .md`
      : 'File importato ✓', missing ? 6000 : 2500);
  }

  const ops = { save, cancel, addImages, importFiles, switchMode: (m) => (mode = m) };
</script>

{#if noteId && !existing}
  <div class="page">
    <h1 class="page-title">Nota non trovata</h1>
    <a href="#/">Torna alla home</a>
  </div>
{:else}
  {#if draftNotice}
    <div class="draft-banner">
      Bozza non salvata recuperata ({timeAgo(draftNotice)}).
      <button class="link-btn" onclick={discardDraft}>Scartala</button>
    </div>
  {/if}
  {#if mode === 'desktop'}
    <EditorDesktop bind:doc {ops} {saving} {uploading} isNew={!noteId} />
  {:else}
    <EditorMobile bind:doc {ops} {saving} {uploading} isNew={!noteId} quick={isQuick} />
  {/if}
{/if}
