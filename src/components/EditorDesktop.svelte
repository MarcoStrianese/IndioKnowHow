<script>
  import TagInput from './TagInput.svelte';
  import Preview from './Preview.svelte';
  import { wrap, prefixLines, insertBlock, handleEnter, insertText, TABLE, callout } from '../lib/editing.js';

  let { doc = $bindable(), ops, saving, uploading, isNew } = $props();
  let ta = $state();
  let view = $state(localStorage.getItem('ikh-editor-view') || 'split'); // write | split | preview
  let dragOver = $state(false);
  let imgInput = $state(), mdInput = $state();

  $effect(() => localStorage.setItem('ikh-editor-view', view));

  function link() {
    const url = prompt('Indirizzo del link (https://… oppure #/n/<id> per un\'altra nota):', 'https://');
    if (url) wrap(ta, doc, '[', `](${url})`, 'testo del link');
  }

  function onkeydown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 's') { e.preventDefault(); ops.save(); }
    else if (mod && e.key === 'b') { e.preventDefault(); wrap(ta, doc, '**'); }
    else if (mod && e.key === 'i') { e.preventDefault(); wrap(ta, doc, '_'); }
    else if (mod && e.key === 'k') { e.preventDefault(); e.stopPropagation(); link(); }
    else if (e.key === 'Enter' && !e.shiftKey && !mod) { if (handleEnter(ta, doc)) e.preventDefault(); }
    else if (e.key === 'Tab') { e.preventDefault(); insertText(ta, doc, '  '); }
  }

  function onpaste(e) {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); ops.addImages(files, ta); }
  }

  function ondrop(e) {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer?.files?.length) ops.importFiles(e.dataTransfer.files, ta);
  }

  // Autoresize disabilitato in modalità affiancata: la textarea scorre da sola.
  const tools = [
    { t: 'Grassetto (Ctrl+B)', l: 'B', cls: 'b', f: () => wrap(ta, doc, '**') },
    { t: 'Corsivo (Ctrl+I)', l: 'I', cls: 'i', f: () => wrap(ta, doc, '_') },
    { t: 'Titolo sezione', l: 'H2', f: () => prefixLines(ta, doc, '## ') },
    { t: 'Sottotitolo', l: 'H3', f: () => prefixLines(ta, doc, '### ') },
    null,
    { t: 'Elenco puntato', l: '•', f: () => prefixLines(ta, doc, '- ') },
    { t: 'Elenco numerato', l: '1.', f: () => prefixLines(ta, doc, '1. ') },
    { t: 'Checklist', l: '☐', f: () => prefixLines(ta, doc, '- [ ] ') },
    null,
    { t: 'Codice in linea', l: '`c`', f: () => wrap(ta, doc, '`') },
    { t: 'Blocco di codice', l: '{ }', f: () => wrap(ta, doc, '\n```\n', '\n```\n', 'codice') },
    { t: 'Link (Ctrl+K)', l: '🔗', f: link },
    { t: 'Tabella', l: '▦', f: () => insertBlock(ta, doc, TABLE) },
    null,
    { t: 'Riquadro nota', l: 'ℹ️', f: () => insertBlock(ta, doc, callout('NOTE') + 'testo') },
    { t: 'Riquadro suggerimento', l: '💡', f: () => insertBlock(ta, doc, callout('TIP') + 'testo') },
    { t: 'Riquadro attenzione', l: '⚠️', f: () => insertBlock(ta, doc, callout('WARNING') + 'testo') },
  ];
</script>

<div class="editor editor-desktop">
  <div class="editor-bar">
    <button class="btn" onclick={ops.cancel}>Annulla</button>
    <div class="seg">
      <button class:on={view === 'write'} onclick={() => (view = 'write')}>Scrivi</button>
      <button class:on={view === 'split'} onclick={() => (view = 'split')}>Affiancato</button>
      <button class:on={view === 'preview'} onclick={() => (view = 'preview')}>Anteprima</button>
    </div>
    <span class="grow"></span>
    {#if uploading}<span class="muted small"><span class="spinner"></span> Caricamento immagini…</span>{/if}
    <button class="link-btn small" onclick={() => ops.switchMode('mobile')}>Editor rapido</button>
    <button class="btn btn-primary" onclick={() => ops.save()} disabled={saving}>{saving ? 'Salvo…' : isNew ? 'Pubblica' : 'Salva'}</button>
  </div>

  <input class="title-input" bind:value={doc.title} placeholder="Titolo della guida" />

  <div class="editor-meta">
    <TagInput bind:tags={doc.tags} />
    <label class="check"><input type="checkbox" bind:checked={doc.needs_review} /> Da rivedere</label>
  </div>

  {#if view !== 'preview'}
    <div class="toolbar">
      {#each tools as tool}
        {#if tool}
          <button type="button" class={'tb ' + (tool.cls || '')} title={tool.t} onmousedown={(e) => e.preventDefault()} onclick={tool.f}>{tool.l}</button>
        {:else}<span class="tb-sep"></span>{/if}
      {/each}
      <span class="tb-sep"></span>
      <button type="button" class="tb" title="Inserisci immagini" onclick={() => imgInput.click()}>🖼 Immagine</button>
      <button type="button" class="tb" title="Importa un file .md (puoi selezionare anche le sue immagini)" onclick={() => mdInput.click()}>📥 Importa .md</button>
      <input bind:this={imgInput} type="file" accept="image/*" multiple hidden onchange={(e) => { ops.addImages(e.target.files, ta); e.target.value = ''; }} />
      <input bind:this={mdInput} type="file" accept=".md,.markdown,.txt,image/*" multiple hidden onchange={(e) => { ops.importFiles(e.target.files, ta); e.target.value = ''; }} />
    </div>
  {/if}

  <div class="editor-panes view-{view}">
    {#if view !== 'preview'}
      <textarea
        bind:this={ta}
        bind:value={doc.body}
        class="md-input"
        class:drag={dragOver}
        {onkeydown}
        {onpaste}
        {ondrop}
        ondragover={(e) => { e.preventDefault(); dragOver = true; }}
        ondragleave={() => (dragOver = false)}
        placeholder={'Scrivi in Markdown.\n\nIncolla screenshot con Ctrl+V, trascina immagini o file .md qui.\n\n## Sezione\n- punto elenco\n> [!WARNING]\n> cosa NON fare'}
        spellcheck="true"
      ></textarea>
    {/if}
    {#if view !== 'write'}
      <Preview body={doc.body} title={view === 'preview' ? doc.title : ''} />
    {/if}
  </div>
</div>
