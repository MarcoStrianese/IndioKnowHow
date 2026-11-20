<script>
  import { app, fetchVersions, saveNote, authorName, toast } from '../lib/store.svelte.js';
  import { go } from '../lib/router.svelte.js';
  import { fullDate } from '../lib/util.js';
  import Preview from './Preview.svelte';

  let { id } = $props();
  const note = $derived(app.notes[id]);
  let versions = $state(null);
  let selected = $state(null);

  $effect(() => {
    fetchVersions(id).then((v) => { versions = v; selected = v[0] || null; })
      .catch((e) => toast('Errore: ' + e.message));
  });

  async function restore() {
    if (!confirm('Ripristinare questa versione? Quella attuale resta nella cronologia.')) return;
    try {
      await saveNote({ id, title: selected.title, body: selected.body, tags: selected.tags, needs_review: note.needs_review }, { force: true });
      toast('Versione ripristinata');
      go('/n/' + id);
    } catch (e) {
      toast('Errore: ' + e.message);
    }
  }
</script>

<div class="page wide">
  <nav class="crumbs"><a href="#/">Home</a> / <a href={'#/n/' + id}>{note?.title || 'nota'}</a> / cronologia</nav>
  <h1 class="page-title">Cronologia</h1>
  {#if versions === null}
    <p class="muted">Caricamento…</p>
  {:else if !versions.length}
    <p class="muted">Nessuna versione precedente: la nota non è mai stata modificata.</p>
  {:else}
    <div class="history">
      <ul class="history-list">
        {#each versions as v (v.id)}
          <li>
            <button class:active={selected?.id === v.id} onclick={() => (selected = v)}>
              <strong>{fullDate(v.created_at)}</strong>
              <span class="muted small">{authorName(v.edited_by_email)}</span>
            </button>
          </li>
        {/each}
      </ul>
      {#if selected}
        <div class="history-view">
          <div class="history-actions"><button class="btn btn-primary" onclick={restore}>Ripristina questa versione</button></div>
          <Preview body={selected.body} title={selected.title} />
        </div>
      {/if}
    </div>
  {/if}
</div>
