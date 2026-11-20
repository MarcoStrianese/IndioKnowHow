<script>
  import TagInput from './TagInput.svelte';
  import Preview from './Preview.svelte';
  import { handleEnter, storageImages } from '../lib/editing.js';
  import { signedUrls } from '../lib/images.js';

  let { doc = $bindable(), ops, saving, uploading, isNew, quick } = $props();
  let ta = $state();
  let preview = $state(false);
  let camInput = $state(), galInput = $state();
  let thumbs = $state({});

  const images = $derived(storageImages(doc.body));
  $effect(() => {
    if (images.length) signedUrls(images).then((u) => (thumbs = u));
  });

  // l'area di testo cresce con il contenuto
  $effect(() => {
    doc.body;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.max(180, ta.scrollHeight) + 'px';
    }
  });

  function pick(input) {
    // la posizione del cursore va letta prima che la tastiera si chiuda
    input.click();
  }
</script>

<div class="editor editor-mobile">
  <div class="m-bar">
    <button class="icon-btn" onclick={ops.cancel} aria-label="Annulla">✕</button>
    <strong>{isNew ? (quick ? 'Nota rapida' : 'Nuova nota') : 'Modifica'}</strong>
    <button class="btn btn-primary" onclick={() => ops.save()} disabled={saving || uploading > 0}>
      {saving ? '…' : 'Salva'}
    </button>
  </div>

  {#if preview}
    <Preview body={doc.body} title={doc.title} />
  {:else}
    <input class="title-input m-title" bind:value={doc.title} placeholder="Titolo (facoltativo)" enterkeyhint="next" />
    <textarea
      bind:this={ta}
      bind:value={doc.body}
      class="m-text"
      placeholder="Scrivi qui… se lasci vuoto il titolo, la prima riga diventa il titolo."
      onkeydown={(e) => { if (e.key === 'Enter' && handleEnter(ta, doc)) e.preventDefault(); }}
    ></textarea>

    {#if images.length || uploading}
      <div class="thumbs">
        {#each images as p (p)}
          {#if thumbs[p]}<img src={thumbs[p]} alt="" />{:else}<div class="thumb-ph"></div>{/if}
        {/each}
        {#each Array(uploading) as _}<div class="thumb-ph"><span class="spinner"></span></div>{/each}
      </div>
    {/if}

    <TagInput bind:tags={doc.tags} />
    <label class="check m-check"><input type="checkbox" bind:checked={doc.needs_review} /> Da rivedere più tardi</label>
  {/if}

  <div class="m-tools">
    <button onclick={() => pick(camInput)}>📷<span>Foto</span></button>
    <button onclick={() => pick(galInput)}>🖼<span>Galleria</span></button>
    <button class:on={preview} onclick={() => (preview = !preview)}>👁<span>{preview ? 'Scrivi' : 'Anteprima'}</span></button>
    <button onclick={() => ops.switchMode('desktop')}>🧰<span>Completo</span></button>
  </div>

  <input bind:this={camInput} type="file" accept="image/*" capture="environment" hidden
    onchange={(e) => { ops.addImages(e.target.files, ta); e.target.value = ''; }} />
  <input bind:this={galInput} type="file" accept="image/*" multiple hidden
    onchange={(e) => { ops.addImages(e.target.files, ta); e.target.value = ''; }} />
</div>
