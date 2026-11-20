<script>
  import { plainText } from '../lib/markdown.js';
  import { authorName } from '../lib/store.svelte.js';
  import { timeAgo } from '../lib/util.js';

  let { notes = [], empty = 'Nessuna nota.' } = $props();
</script>

{#if !notes.length}
  <p class="muted empty">{empty}</p>
{:else}
  <ul class="note-list">
    {#each notes as n (n.id)}
      <li>
        <a href={'#/n/' + n.id} class="note-item">
          <div class="note-item-title">
            {n.title}
            {#if n.needs_review}<span class="pill pill-review">da rivedere</span>{/if}
          </div>
          {#if n.snippet ?? n.body}
            <div class="note-item-snippet">{n.snippet ?? plainText(n.body, 160)}</div>
          {/if}
          <div class="note-item-meta">
            {#each (n.tags || []).slice(0, 5) as t}<span class="tag tag-sm">{t}</span>{/each}
            <span class="muted">{n.updated_by_email ? authorName(n.updated_by_email) + ' · ' : ''}{timeAgo(n.updated_at)}</span>
          </div>
        </a>
      </li>
    {/each}
  </ul>
{/if}
