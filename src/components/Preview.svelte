<script>
  import { renderMarkdown } from '../lib/markdown.js';
  import { resolveImages } from '../lib/images.js';

  let { body = '', title = '' } = $props();
  let el = $state();
  let html = $state('');
  let timer;

  // anteprima con un piccolo ritardo per non rallentare la scrittura
  $effect(() => {
    const src = body;
    clearTimeout(timer);
    timer = setTimeout(() => (html = renderMarkdown(src).html), html ? 150 : 0);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    html;
    if (el) resolveImages(el);
  });
</script>

<div class="preview">
  {#if title}<h1 class="doc-title">{title}</h1>{/if}
  <div class="markdown-body" bind:this={el}>{@html html}</div>
</div>
