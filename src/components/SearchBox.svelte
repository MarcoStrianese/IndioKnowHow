<script>
  import { onMount } from 'svelte';
  import { route, go } from '../lib/router.svelte.js';

  let input;
  let value = $state(route.path === '/search' ? route.query.q || '' : '');

  // se si esce dalla ricerca, svuota la casella
  $effect(() => {
    if (route.path !== '/search') value = '';
    else if ((route.query.q || '') !== value && document.activeElement !== input) value = route.query.q || '';
  });

  function oninput() {
    const q = value;
    if (!q.trim()) {
      if (route.path === '/search') go('/', { replace: true });
      return;
    }
    go('/search?q=' + encodeURIComponent(q), { replace: route.path === '/search' });
  }

  onMount(() => {
    const key = (e) => {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        input?.focus();
        input?.select();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
</script>

<div class="searchbox">
  <span class="search-icon" aria-hidden="true">🔍</span>
  <input
    bind:this={input}
    bind:value
    {oninput}
    onkeydown={(e) => e.key === 'Escape' && (value = '', oninput(), input.blur())}
    type="search"
    placeholder="Cerca… (es. autostart windows)"
    enterkeyhint="search"
    autocomplete="off"
    aria-label="Cerca nelle note"
  />
  <kbd class="hint">Ctrl K</kbd>
</div>
