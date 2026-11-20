<script>
  import { searchNotes } from '../lib/search.js';
  import { app } from '../lib/store.svelte.js';
  import NoteList from './NoteList.svelte';

  let { q = '' } = $props();
  let results = $state([]);
  let loading = $state(false);
  let seq = 0;
  let timer;

  $effect(() => {
    const query = q;
    app.notes; // ricalcola quando arrivano note nuove
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const my = ++seq;
      loading = true;
      const r = await searchNotes(query);
      if (my === seq) { results = r; loading = false; }
    }, 180);
    return () => clearTimeout(timer);
  });
</script>

<div class="page">
  <h1 class="page-title">Risultati per “{q}”</h1>
  {#if !app.online}<p class="muted small">Offline: ricerca sulla copia salvata nel dispositivo.</p>{/if}
  {#if loading && !results.length}
    <p class="muted">Cerco…</p>
  {:else}
    <NoteList notes={results} empty="Nessun risultato. Prova con un sinonimo o con un tag." />
  {/if}
</div>
