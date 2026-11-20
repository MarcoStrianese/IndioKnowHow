<script>
  import { fetchTrash, setDeleted, toast } from '../lib/store.svelte.js';
  import { fullDate } from '../lib/util.js';

  let items = $state(null);
  const load = () => fetchTrash().then((d) => (items = d)).catch((e) => toast('Errore: ' + e.message));
  $effect(() => { load(); });

  async function restore(n) {
    try {
      await setDeleted(n.id, false);
      toast('Ripristinata');
      items = items.filter((x) => x.id !== n.id);
    } catch (e) {
      toast('Errore: ' + e.message);
    }
  }
</script>

<div class="page">
  <h1 class="page-title">Cestino</h1>
  <p class="muted">Le note nel cestino non compaiono nella ricerca. Puoi ripristinarle in qualsiasi momento.</p>
  {#if items === null}
    <p class="muted">Caricamento…</p>
  {:else if !items.length}
    <p class="muted empty">Il cestino è vuoto.</p>
  {:else}
    <ul class="note-list">
      {#each items as n (n.id)}
        <li class="note-item trash-item">
          <div>
            <div class="note-item-title">{n.title}</div>
            <div class="muted small">Eliminata il {fullDate(n.deleted_at)}</div>
          </div>
          <button class="btn" onclick={() => restore(n)}>Ripristina</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
