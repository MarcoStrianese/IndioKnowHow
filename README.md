# IndioKnowHow

Il manuale da campo dello studio. È un'unica web-app che si usa da telefono e da PC:

- **Dal telefono:** note al volo, foto scattate direttamente, ricerca immediata, consultazione anche **offline**.
- **Dal PC:** guide curate con editor Markdown, anteprima affiancata, screenshot incollati con Ctrl+V, import di file `.md`.
- **Visualizzazione wiki** in stile Notion/GitHub: indice laterale, riquadri (Nota, Attenzione, Suggerimento), codice evidenziato con pulsante Copia, tabelle, checklist, tema chiaro e scuro automatico.

**Stack:** Svelte + Vite (sito statico su GitHub Pages) e Supabase (login, database Postgres, archivio immagini).

> **Stato attuale:** il progetto Supabase `IndioKnowHow` (Francoforte) è già creato, con lo schema applicato e la nota di benvenuto. `src/config.js` è già compilato. Restano solo il punto 2.3 (disattivare le registrazioni), il 2.4 (creare il tuo utente) e la pubblicazione (sezione 5).

---

## 1. Cosa serve

- **Node.js 20 o superiore** (versione LTS da nodejs.org)
- **Git**
- Un account **GitHub** e un account **Supabase**

---

## 2. Database su Supabase (una volta sola)

1. Su [supabase.com](https://supabase.com) crea un nuovo progetto, per esempio `indioknowhow`, nella regione **Central EU (Frankfurt)**.
2. Apri **SQL Editor → New query**, incolla tutto il contenuto di `supabase/schema.sql` e premi **Run**.
   Lo script crea tabelle, ricerca, cronologia, archivio immagini privato, regole di sicurezza e una nota di benvenuto. Puoi rieseguirlo senza problemi.
3. In **Authentication → Sign In / Providers** disattiva **"Allow new users to sign up"**. Gli account li crei tu.
4. In **Authentication → Users → Add user → Create new user** inserisci email e password e spunta **Auto Confirm User**.

### Aggiungere un collega

Crea l'utente come al punto 4, poi esegui nel SQL Editor:

```sql
insert into public.members (email, display_name)
values ('nome.cognome@indiotech.com', 'Nome Cognome');
```

Senza questa riga l'utente può fare login ma non vede nulla. È voluto: il login da solo non basta.

---

## 3. Collegare l'app al database

Apri `src/config.js` e inserisci i due valori del progetto (pulsante **Connect** in alto, oppure **Project Settings → API Keys**):

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_...';   // oppure la vecchia "anon key"
```

La chiave *publishable* è fatta per stare nel browser. I dati sono protetti dal login e dalle regole del database (RLS). **Non** usare mai la chiave `secret` / `service_role`.

---

## 4. Provare in locale

```bash
npm install
npm run dev
```

Apri http://localhost:5173 ed entra con l'utente creato al punto 2.

Per provare la versione compilata (come sarà online):

```bash
npm run build
npm run preview
```

---

## 5. Pubblicare su GitHub Pages

1. Su GitHub crea un repository, per esempio `indioknowhow`.
   Con l'account GitHub gratuito, GitHub Pages funziona solo con repository **pubblici**. Il codice non contiene dati: note e immagini restano su Supabase, dietro il login. Se vuoi un repository privato serve GitHub Pro/Team, oppure puoi usare Cloudflare Pages (sezione 8).
2. Dalla cartella del progetto:

   ```bash
   git init
   git add .
   git commit -m "IndioKnowHow"
   git branch -M main
   git remote add origin https://github.com/TUO-UTENTE/indioknowhow.git
   git push -u origin main
   ```

3. Su GitHub apri **Settings → Pages → Build and deployment → Source** e scegli **GitHub Actions**.
4. Vai su **Actions**: il workflow "Pubblica su GitHub Pages" parte a ogni push. Quando diventa verde l'app è online su
   `https://TUO-UTENTE.github.io/indioknowhow/`

Per aggiornare l'app modifichi il codice, poi `git add .`, `git commit -m "..."` e `git push`. Dopo un minuto è online.

### Tenere sveglio Supabase (consigliato)

Il piano gratuito sospende i progetti inattivi da circa una settimana. Il workflow `keepalive.yml` interroga il database due volte a settimana. Per attivarlo vai in **Settings → Secrets and variables → Actions → New repository secret** e aggiungi:

- `SUPABASE_URL`: lo stesso valore di `config.js`
- `SUPABASE_KEY`: la stessa chiave publishable

---

## 6. Installare sul telefono

Apri l'indirizzo dell'app e poi:

- **iPhone (Safari):** Condividi → **Aggiungi alla schermata Home**
- **Android (Chrome):** menu ⋮ → **Installa app**

Si apre a schermo intero come un'app. Resti collegato e le note già sincronizzate si consultano anche senza campo.

---

## 7. Come si usa

| Dove | Cosa |
| --- | --- |
| Telefono | **＋** in basso a destra apre la nota rapida. 📷 scatta una foto, 🖼 la prende dalla galleria. Senza titolo, la prima riga diventa il titolo. |
| PC | **＋ Nuova pagina** apre l'editor completo: Scrivi / Affiancato / Anteprima. |
| PC | **Ctrl+V** incolla uno screenshot. Puoi trascinare immagini o file `.md` (con le loro immagini) nell'area di testo. |
| PC | **Ctrl+S** salva, **Ctrl+B / Ctrl+I** grassetto/corsivo, **Ctrl+K** cerca (inserisce un link mentre scrivi). |
| Ovunque | **Da rivedere:** le note rapide nascono così e le ritrovi nel menu, da sistemare con calma. |
| Ovunque | **⋯** su una nota: cronologia delle versioni (con ripristino), copia link, cestino (recuperabile). |

**Riquadri** (stile GitHub):

```markdown
> [!WARNING]
> Cosa non fare.

> [!TIP]
> Il trucco.
```

Tipi disponibili: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`.

**Ricerca:** cerca in titolo e tag prima di tutto, poi nel testo. Trova i prefissi mentre digiti (`bl20-e-g`), tollera gli errori di battitura (`ethercta`), riconosce le forme delle parole italiane (`configurazione` trova anche `configurazioni`) e lascia intatti i codici prodotto. Offline cerca sulla copia salvata nel dispositivo.

---

## 8. Note tecniche

- **Struttura**

  ```
  src/config.js          ← unico file da configurare
  src/lib/               ← logica (dati, sync offline, ricerca, immagini, markdown)
  src/components/        ← schermate (vista wiki, editor PC, editor telefono, …)
  public/sw.js           ← service worker (offline)
  supabase/schema.sql    ← database completo
  ```

- **Offline:** la copia delle note sta in IndexedDB e viene sincronizzata all'avvio, quando torni sull'app e ogni 2 minuti. Le foto sono disponibili offline se le hai già viste almeno una volta online su quel dispositivo. Scrivere offline non è ancora supportato: la bozza resta salvata sul dispositivo e la salvi quando torni online.
- **Foto:** vengono ridimensionate a 1920 px e ricompresse nel browser prima del caricamento (in genere da 4–8 MB a 200–500 KB). La ricompressione elimina anche i metadati, compresa la **posizione GPS**.
- **Immagini private:** stanno in un bucket non pubblico e vengono mostrate con link firmati validi 7 giorni, rinnovati automaticamente. Nel testo compaiono come `storage:percorso`.
- **Modifiche in contemporanea:** se due persone modificano la stessa nota, chi salva per secondo riceve un avviso. Ogni modifica salva comunque la versione precedente nella cronologia.
- **Alternativa con repository privato:** Cloudflare Pages (gratuito). Colleghi il repository e imposti il comando di build `npm run build` e la cartella di output `dist`.

### Idee per le prossime versioni

- Scrittura offline con coda di sincronizzazione
- Esportazione/backup automatico di tutte le note in `.md` su un repository privato
- Ricerca semantica (pgvector) e tag suggeriti automaticamente
- Accesso alle note da un assistente AI, per fare domande sulla vostra esperienza accumulata
