// Markdown -> HTML in stile wiki (GitHub/Notion): titoli con ancore, indice, callout, codice evidenziato.
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import dos from 'highlight.js/lib/languages/dos';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import ini from 'highlight.js/lib/languages/ini';
import yaml from 'highlight.js/lib/languages/yaml';
import javascript from 'highlight.js/lib/languages/javascript';
import sql from 'highlight.js/lib/languages/sql';
import plaintext from 'highlight.js/lib/languages/plaintext';

Object.entries({ c, cpp, csharp, python, bash, powershell, dos, json, xml, ini, yaml, javascript, sql, plaintext })
  .forEach(([name, lang]) => hljs.registerLanguage(name, lang));
hljs.registerAliases(['sh', 'shell'], { languageName: 'bash' });
hljs.registerAliases(['bat', 'cmd'], { languageName: 'dos' });
hljs.registerAliases(['ps', 'ps1'], { languageName: 'powershell' });
hljs.registerAliases(['js'], { languageName: 'javascript' });
hljs.registerAliases(['cs'], { languageName: 'csharp' });
hljs.registerAliases(['py'], { languageName: 'python' });
hljs.registerAliases(['text', 'txt'], { languageName: 'plaintext' });

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const md = new Marked({ gfm: true, breaks: true });
md.use({
  renderer: {
    image({ href, title, text }) {
      if (href && href.startsWith('storage:')) {
        const t = title ? ` title="${esc(title)}"` : '';
        return `<img data-storage="${esc(href.slice(8))}" alt="${esc(text || '')}"${t} loading="lazy">`;
      }
      return false;
    },
    code({ text, lang }) {
      const language = (lang || '').trim().split(/\s+/)[0].toLowerCase();
      const body = language && hljs.getLanguage(language)
        ? hljs.highlight(text, { language, ignoreIllegals: true }).value
        : esc(text);
      return `<pre><code class="hljs${language ? ' language-' + esc(language) : ''}">${body}</code></pre>`;
    },
  },
});

const CALLOUTS = {
  note: { label: 'Nota', icon: 'ℹ️' },
  tip: { label: 'Suggerimento', icon: '💡' },
  important: { label: 'Importante', icon: '📌' },
  warning: { label: 'Attenzione', icon: '⚠️' },
  caution: { label: 'Pericolo', icon: '⛔' },
};

export function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'sezione';
}

/** Restituisce { html, toc } già sanificato. */
export function renderMarkdown(src) {
  const raw = md.parse(src || '');
  const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ['data-storage', 'target'] });
  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  const root = tpl.content;

  // Titoli: id + indice
  const used = new Map();
  const toc = [];
  root.querySelectorAll('h1,h2,h3,h4').forEach((h) => {
    const base = slugify(h.textContent);
    const n = used.get(base) || 0;
    used.set(base, n + 1);
    const id = n ? `${base}-${n}` : base;
    h.id = id;
    toc.push({ id, text: h.textContent, level: Number(h.tagName[1]) });
    const a = document.createElement('a');
    a.className = 'anchor';
    a.href = '#' + id;
    a.dataset.anchor = id;
    a.textContent = '#';
    h.prepend(a);
  });

  // Callout stile GitHub:  > [!WARNING]
  root.querySelectorAll('blockquote').forEach((bq) => {
    const p = bq.firstElementChild;
    if (!p || p.tagName !== 'P') return;
    const m = p.innerHTML.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br>\s*)?/i);
    if (!m) return;
    const type = m[1].toLowerCase();
    p.innerHTML = p.innerHTML.slice(m[0].length);
    if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
    bq.classList.add('callout', 'callout-' + type);
    const title = document.createElement('div');
    title.className = 'callout-title';
    title.textContent = `${CALLOUTS[type].icon} ${CALLOUTS[type].label}`;
    bq.prepend(title);
  });

  // Blocchi di codice: pulsante copia
  root.querySelectorAll('pre').forEach((pre) => {
    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    pre.replaceWith(wrap);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'Copia';
    wrap.append(btn, pre);
  });

  // Tabelle scorrevoli su telefono
  root.querySelectorAll('table').forEach((t) => {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    t.replaceWith(wrap);
    wrap.append(t);
  });

  // Link esterni in nuova scheda
  root.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  const div = document.createElement('div');
  div.append(root);
  return { html: div.innerHTML, toc };
}

/** Testo semplice per anteprime ed elenchi. */
export function plainText(src, max = 200) {
  return (src || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[\[[^\]]*\]\]/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, '')
    .replace(/^\s*(#{1,6}|>|[-*+](\s\[[ xX]\])?|\d+\.)\s+/gm, '')
    .replace(/^\s*\|?\s*-{3,}.*$/gm, '')
    .replace(/[*_`|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Legge un file .md: frontmatter (title, tags) o primo titolo "# ". */
export function parseMarkdownFile(text, filename = '') {
  let body = text.replace(/\r\n/g, '\n');
  let title = '';
  let tags = [];
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = body.slice(fm[0].length);
    const lines = fm[1].split('\n');
    for (let i = 0; i < lines.length; i++) {
      const kv = lines[i].match(/^(\w+)\s*:\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1].toLowerCase();
      let val = kv[2].trim();
      if (key === 'title') title = val.replace(/^["']|["']$/g, '');
      if (key === 'tags' || key === 'keywords') {
        if (val.startsWith('[')) {
          tags = val.slice(1, -1).split(',');
        } else if (val) {
          tags = val.split(/[,\s]+/);
        } else {
          while (lines[i + 1] && /^\s*-\s+/.test(lines[i + 1])) tags.push(lines[++i].replace(/^\s*-\s+/, ''));
        }
      }
    }
    tags = tags.map((t) => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  if (!title) {
    const h1 = body.match(/^\s*#\s+(.+)\n?/);
    if (h1) {
      title = h1[1].trim();
      body = body.slice(h1[0].length);
    }
  }
  if (!title && filename) title = filename.replace(/\.(md|markdown|txt)$/i, '').replace(/[_-]+/g, ' ');
  return { title, tags, body: body.trim() + '\n' };
}
