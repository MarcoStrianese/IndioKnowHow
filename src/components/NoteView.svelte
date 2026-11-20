<script>
  import { supabase } from '../lib/supabase.js';
  import { app, COLS, mergeNote, saveNote, setDeleted, authorName, toast } from '../lib/store.svelte.js';
  import { go } from '../lib/router.svelte.js';
  import { renderMarkdown } from '../lib/markdown.js';
  import { resolveImages } from '../lib/images.js';
  import { timeAgo, fullDate } from '../lib/util.js';

  let { id } = $props();
  let notFound = $state(false);
  let bodyEl = $state();
  let lightbox = $state(null);
  let menu = $state(false);
  let activeId = $state('');

  const note = $derived(app.notes[id]);
  const rendered = $derived(note ? renderMarkdown(note.body) : { html: '', toc: [] });

  // nota non ancora in cache: chiedila al server
  $effect(() => {
    if (!note && supabase && navigator.onLine) {
      supabase.from('notes').select(COLS).eq('id', id).maybeSingle().then(({ data }) => {
        if (data && !data.deleted_at) mergeNote(data);
        else notFound = true;
      });
    } else if (!note) notFound = true;
  });

  $effect(() => {
    rendered.html;
    if (bodyEl) resolveImages(bodyEl);
  });

  // evidenzia la sezione corrente nell'indice
  $effect(() => {
    if (!bodyEl || rendered.toc.length < 3) return;
    const hs = [...bodyEl.querySelectorAll('h1,h2,h3,h4')];
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting);
        if (vis.length) activeId = vis[0].target.id;
      },
      { rootMargin: '-60px 0px -70% 0px' }
    );
    hs.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  });

  function scrollTo(hid) {
    document.getElementById(hid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onBodyClick(e) {
    const copy = e.target.closest('.copy-btn');
    if (copy) {
      const code = copy.parentElement.querySelector('code')?.innerText || '';
      navigator.clipboard?.writeText(code).then(() => {
        copy.textContent = 'Copiato ✓';
        setTimeout(() => (copy.textContent = 'Copia'), 1500);
      });
      return;
    }
    const anchor = e.target.closest('a[data-anchor]');
    if (anchor) {
      e.preventDefault();
      scrollTo(anchor.dataset.anchor);
      return;
    }
    const a = e.target.closest('a[href^="#"]');
    if (a && !a.getAttribute('href').startsWith('#/')) {
      e.preventDefault();
      scrollTo(decodeURIComponent(a.getAttribute('href').slice(1)));
      return;
    }
    const img = e.target.closest('img');
    if (img?.src) lightbox = img.src;
  }

  async function toggleReview() {
    menu = false;
    try {
      await saveNote({ ...note, needs_review: !note.needs_review, base_updated_at: note.updated_at });
      toast(note.needs_review ? 'Segnata da rivedere' : 'Segnata come rivista');
    } catch (e) {
      toast(e.conflict ? 'Nota modificata da altri: ricarica e riprova' : 'Errore: ' + e.message);
    }
  }

  async function trash() {
    menu = false;
    if (!confirm(`Spostare "${note.title}" nel cestino?`)) return;
    try {
      await setDeleted(id, true);
      toast('Spostata nel cestino');
      go('/');
    } catch (e) {
      toast('Errore: ' + e.message);
    }
  }

  function copyLink() {
    menu = false;
    navigator.clipboard?.writeText(location.href).then(() => toast('Link copiato'));
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (lightbox = null, menu = false)} />

{#if note}
  <div class="doc-layout" class:has-toc={rendered.toc.length >= 3}>
    <article class="doc">
      <nav class="crumbs">
        <a href="#/">Home</a>
        {#if note.tags?.[0]} / <a href={'#/tag/' + encodeURIComponent(note.tags[0])}>{note.tags[0]}</a>{/if}
      </nav>

      <div class="doc-actions">
        <button class="btn" onclick={() => go(`/n/${id}/edit`)} disabled={!app.online} title={app.online ? '' : 'Offline: modifica non disponibile'}>✏️ Modifica</button>
        <div class="menu-wrap">
          <button class="btn icon-only" onclick={() => (menu = !menu)} aria-label="Altre azioni">⋯</button>
          {#if menu}
            <div class="menu" role="menu">
              <button onclick={toggleReview} disabled={!app.online}>{note.needs_review ? '✅ Segna come rivista' : '📝 Segna da rivedere'}</button>
              <button onclick={() => go(`/n/${id}/history`)} disabled={!app.online}>🕘 Cronologia</button>
              <button onclick={copyLink}>🔗 Copia link</button>
              <button class="danger" onclick={trash} disabled={!app.online}>🗑 Sposta nel cestino</button>
            </div>
          {/if}
        </div>
      </div>

      <h1 class="doc-title">{note.title}</h1>

      <div class="doc-meta">
        {#each note.tags || [] as t}<a class="tag" href={'#/tag/' + encodeURIComponent(t)}>{t}</a>{/each}
        <span class="muted small" title={'Creata il ' + fullDate(note.created_at) + ' da ' + authorName(note.created_by_email)}>
          {authorName(note.updated_by_email || note.created_by_email)} · aggiornata {timeAgo(note.updated_at)}
        </span>
      </div>

      {#if note.needs_review}
        <div class="review-banner">📝 Nota scritta al volo, da rivedere. <button class="link-btn" onclick={() => go(`/n/${id}/edit`)}>Sistemala</button></div>
      {/if}

      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="markdown-body" bind:this={bodyEl} onclick={onBodyClick}>
        {@html rendered.html}
      </div>
    </article>

    {#if rendered.toc.length >= 3}
      <aside class="toc">
        <div class="toc-title">In questa pagina</div>
        {#each rendered.toc as h (h.id)}
          <button class="toc-item lvl-{h.level}" class:active={activeId === h.id} onclick={() => scrollTo(h.id)}>{h.text}</button>
        {/each}
      </aside>
    {/if}
  </div>
{:else if notFound}
  <div class="page">
    <h1 class="page-title">Nota non trovata</h1>
    <p class="muted">Potrebbe essere stata spostata nel cestino{app.online ? '' : ' o non è ancora stata scaricata su questo dispositivo'}.</p>
    <a href="#/">Torna alla home</a>
  </div>
{:else}
  <div class="page"><p class="muted">Caricamento…</p></div>
{/if}

{#if lightbox}
  <button class="lightbox" onclick={() => (lightbox = null)} aria-label="Chiudi immagine">
    <img src={lightbox} alt="" />
  </button>
{/if}
