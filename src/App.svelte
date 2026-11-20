<script>
  import { onMount } from 'svelte';
  import { supabase, configured } from './lib/supabase.js';
  import { app, loadLocal, sync } from './lib/store.svelte.js';
  import { route, match, go } from './lib/router.svelte.js';
  import Login from './components/Login.svelte';
  import Setup from './components/Setup.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import SearchBox from './components/SearchBox.svelte';
  import Home from './components/Home.svelte';
  import NoteView from './components/NoteView.svelte';
  import Editor from './components/Editor.svelte';
  import History from './components/History.svelte';
  import NoteList from './components/NoteList.svelte';
  import SearchResults from './components/SearchResults.svelte';
  import Trash from './components/Trash.svelte';

  let authChecked = $state(false);
  let drawer = $state(false);

  onMount(async () => {
    await loadLocal();
    if (!supabase) { authChecked = true; return; }
    const { data } = await supabase.auth.getSession();
    app.session = data.session;
    authChecked = true;
    supabase.auth.onAuthStateChange((_ev, s) => {
      const was = !!app.session;
      app.session = s;
      if (s && !was) sync();
    });
    if (app.session) sync();

    const on = () => { app.online = true; sync(); };
    const off = () => (app.online = false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
    setInterval(() => { if (!document.hidden) sync(); }, 120000);
  });

  // chiudi il menu laterale quando cambi pagina
  $effect(() => { route.path; drawer = false; });

  const editing = $derived(route.path === '/new' || !!match('/n/:id/edit'));
  const sortedNotes = $derived(Object.values(app.notes).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
</script>

{#if !configured}
  <Setup />
{:else if !authChecked || !app.ready}
  <div class="splash">Caricamento…</div>
{:else if !app.session}
  <Login />
{:else}
  <div class="layout" class:drawer-open={drawer} class:editing>
    <Sidebar />
    <div class="scrim" onclick={() => (drawer = false)} role="presentation"></div>

    <div class="main-col">
      <header class="topbar">
        <button class="icon-btn menu-btn" onclick={() => (drawer = !drawer)} aria-label="Menu">☰</button>
        <SearchBox />
        <div class="status" title={app.online ? 'Online' : 'Offline: stai consultando la copia salvata sul dispositivo'}>
          {#if !app.online}<span class="pill pill-offline">offline</span>
          {:else if app.syncing}<span class="spinner" aria-label="Sincronizzazione"></span>{/if}
        </div>
      </header>

      <main class="content">
        {#if route.path === '/'}
          <Home />
        {:else if route.path === '/search'}
          <SearchResults q={route.query.q || ''} />
        {:else if route.path === '/new'}
          {#key route.query.quick}<Editor id={null} quick={route.query.quick === '1'} />{/key}
        {:else if match('/n/:id/edit')}
          {#key match('/n/:id/edit').id}<Editor id={match('/n/:id/edit').id} />{/key}
        {:else if match('/n/:id/history')}
          <History id={match('/n/:id/history').id} />
        {:else if match('/n/:id')}
          {#key match('/n/:id').id}<NoteView id={match('/n/:id').id} />{/key}
        {:else if match('/tag/:tag')}
          {@const tag = match('/tag/:tag').tag}
          <div class="page">
            <nav class="crumbs"><a href="#/">Home</a> / tag</nav>
            <h1 class="page-title"><span class="tag-hash">#</span>{tag}</h1>
            <NoteList notes={sortedNotes.filter((n) => n.tags?.includes(tag))} />
          </div>
        {:else if route.path === '/review'}
          <div class="page">
            <h1 class="page-title">Da rivedere</h1>
            <p class="muted">Note scritte di fretta da sistemare con calma.</p>
            <NoteList notes={sortedNotes.filter((n) => n.needs_review)} empty="Niente da rivedere. 🎉" />
          </div>
        {:else if route.path === '/all'}
          <div class="page">
            <h1 class="page-title">Tutte le note</h1>
            <NoteList notes={sortedNotes} />
          </div>
        {:else if route.path === '/trash'}
          <Trash />
        {:else}
          <div class="page"><h1 class="page-title">Pagina non trovata</h1><a href="#/">Torna alla home</a></div>
        {/if}
      </main>
    </div>

    {#if !editing}
      <button class="fab" onclick={() => go('/new?quick=1')} aria-label="Nuova nota rapida">＋</button>
    {/if}
  </div>
{/if}

{#if app.toast}<div class="toast" role="status">{app.toast}</div>{/if}
