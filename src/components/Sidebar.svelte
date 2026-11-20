<script>
  import { app, tagCounts, signOut, authorName } from '../lib/store.svelte.js';
  import { route, go } from '../lib/router.svelte.js';
  import { APP_NAME } from '../config.js';

  const tags = $derived(tagCounts());
  const reviewCount = $derived(Object.values(app.notes).filter((n) => n.needs_review).length);
  const recent = $derived(
    Object.values(app.notes).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8)
  );
  let showAllTags = $state(false);
  const me = $derived(app.session?.user?.email);

  async function logout() {
    if (confirm('Uscire? La copia offline delle note verrà cancellata da questo dispositivo.')) await signOut();
  }
</script>

<aside class="sidebar">
  <a class="brand" href="#/"><img src="./icon.svg" alt="" width="24" height="24" /> {APP_NAME}</a>

  <button class="btn btn-primary btn-block new-btn" onclick={() => go('/new')}>＋ Nuova pagina</button>

  <nav class="side-nav">
    <a href="#/" class:active={route.path === '/'}>🏠 Home</a>
    <a href="#/all" class:active={route.path === '/all'}>📚 Tutte le note <span class="count">{Object.keys(app.notes).length}</span></a>
    <a href="#/review" class:active={route.path === '/review'}>📝 Da rivedere {#if reviewCount}<span class="count badge">{reviewCount}</span>{/if}</a>
  </nav>

  {#if recent.length}
    <div class="side-section">
      <div class="side-title">Recenti</div>
      {#each recent as n (n.id)}
        <a class="side-link" class:active={route.path.startsWith('/n/' + n.id)} href={'#/n/' + n.id}>{n.title}</a>
      {/each}
    </div>
  {/if}

  {#if tags.length}
    <div class="side-section">
      <div class="side-title">Tag</div>
      <div class="side-tags">
        {#each showAllTags ? tags : tags.slice(0, 20) as [t, c] (t)}
          <a class="tag" class:active={route.path === '/tag/' + t} href={'#/tag/' + encodeURIComponent(t)}>{t} <span>{c}</span></a>
        {/each}
      </div>
      {#if tags.length > 20}
        <button class="link-btn" onclick={() => (showAllTags = !showAllTags)}>{showAllTags ? 'Meno' : `Tutti (${tags.length})`}</button>
      {/if}
    </div>
  {/if}

  <div class="side-footer">
    <a href="#/trash" class:active={route.path === '/trash'}>🗑 Cestino</a>
    <div class="me">
      <span title={me}>{authorName(me)}</span>
      <button class="link-btn" onclick={logout}>Esci</button>
    </div>
  </div>
</aside>
