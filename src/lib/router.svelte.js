// Router minimale basato sull'hash (#/...): funziona su GitHub Pages senza configurazioni.
export const route = $state({ path: '/', query: {} });

function parse() {
  const h = decodeURI(location.hash.slice(1)) || '/';
  const [p, qs] = h.split('?');
  route.path = p || '/';
  route.query = Object.fromEntries(new URLSearchParams(qs || ''));
}

window.addEventListener('hashchange', parse);
parse();

export function go(path, { replace = false } = {}) {
  if (replace) {
    history.replaceState(null, '', '#' + path);
    parse();
  } else {
    location.hash = path;
  }
}

/** Confronta il percorso con uno schema tipo "/n/:id/edit" e restituisce i parametri. */
export function match(pattern, path = route.path) {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
