<script>
  import { app, tagCounts, authorName } from '../lib/store.svelte.js';
  import { go } from '../lib/router.svelte.js';
  import NoteList from './NoteList.svelte';

  const recent = $derived(
    Object.values(app.notes).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 15)
  );
  const review = $derived(Object.values(app.notes).filter((n) => n.needs_review).length);
  const tags = $derived(tagCounts().slice(0, 30));
  const name = $derived(authorName(app.session?.user?.email).split(' ')[0]);
</script>

<div class="page">
  <h1 class="page-title">Ciao {name} 👋</h1>

  <div class="quick-actions">
    <button class="action-card" onclick={() => go('/new?quick=1')}>
      <span class="action-icon">⚡</span><strong>Nota rapida</strong><span class="muted small">Testo, foto, due tag</span>
    </button>
    <button class="action-card" onclick={() => go('/new')}>
      <span class="action-icon">📄</span><strong>Nuova guida</strong><span class="muted small">Editor completo</span>
    </button>
    {#if review}
      <a class="action-card" href="#/review">
        <span class="action-icon">📝</span><strong>{review} da rivedere</strong><span class="muted small">Note da sistemare</span>
      </a>
    {/if}
  </div>

  {#if tags.length}
    <div class="tag-cloud">
      {#each tags as [t, c] (t)}<a class="tag" href={'#/tag/' + encodeURIComponent(t)}>{t} <span>{c}</span></a>{/each}
    </div>
  {/if}

  <h2 class="section-title">Ultime modifiche</h2>
  <NoteList
    notes={recent}
    empty={app.syncing ? 'Sincronizzazione in corso…' : 'Ancora nessuna nota. Inizia con il pulsante ＋.'}
  />
</div>
