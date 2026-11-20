<script>
  import { tagCounts } from '../lib/store.svelte.js';
  import { normalizeTag } from '../lib/editing.js';

  let { tags = $bindable([]) } = $props();
  let text = $state('');
  let focused = $state(false);

  const all = $derived(tagCounts().map(([t]) => t));
  const suggestions = $derived(
    text.trim()
      ? all.filter((t) => t.includes(normalizeTag(text)) && !tags.includes(t)).slice(0, 6)
      : focused ? all.filter((t) => !tags.includes(t)).slice(0, 6) : []
  );

  function add(t) {
    const n = normalizeTag(t);
    if (n && !tags.includes(n)) tags = [...tags, n];
    text = '';
  }
  function remove(t) {
    tags = tags.filter((x) => x !== t);
  }
  function onkeydown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (text.trim()) add(text);
    } else if (e.key === 'Backspace' && !text && tags.length) {
      tags = tags.slice(0, -1);
    }
  }
</script>

<div class="tag-input">
  {#each tags as t (t)}
    <span class="tag tag-chip">{t}<button type="button" onclick={() => remove(t)} aria-label={'Rimuovi ' + t}>×</button></span>
  {/each}
  <input
    bind:value={text}
    {onkeydown}
    onfocus={() => (focused = true)}
    onblur={() => setTimeout(() => { focused = false; if (text.trim()) add(text); }, 150)}
    placeholder={tags.length ? 'altro tag…' : 'Tag e parole chiave (Invio per aggiungere)'}
    autocapitalize="none"
    autocomplete="off"
    enterkeyhint="done"
  />
  {#if suggestions.length}
    <div class="tag-suggest">
      {#each suggestions as s (s)}
        <button type="button" onmousedown={(e) => { e.preventDefault(); add(s); }}>{s}</button>
      {/each}
    </div>
  {/if}
</div>
