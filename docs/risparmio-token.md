# Risparmio token in Claude Code

Questo repo usa due strumenti esterni e tre sotto-agenti per far spendere meno token a Claude Code.

| Cosa | A cosa serve | Dove è configurato |
|---|---|---|
| [graphify](https://github.com/Graphify-Labs/graphify) | Costruisce un grafo del codice (componenti, funzioni, tabelle SQL e chi usa chi). Claude interroga il grafo invece di aprire decine di file. | CLAUDE.md, .claude/settings.json (hook), .gitignore |
| [Ponytail](https://github.com/DietrichGebert/ponytail) | Regole di stile: la modifica più piccola che risolve tutto, riuso del codice esistente, risposte brevi. Meno codice scritto e meno token in uscita. | .claude/settings.json (plugin), .claude/ponytail-rules.md (copia per il cloud) |
| Sotto-agenti | `esploratore` (Haiku) per ricerche, `sviluppatore` (Sonnet) per modifiche circoscritte, `sicurezza-db` (Opus) per database e sicurezza. | .claude/agents/ |

## Installazione sul PC (Windows)

Da fare una volta sola, in PowerShell.

1. **uv** (installa programmi Python isolati):
   ```powershell
   winget install --id=astral-sh.uv -e
   ```
   Chiudi e riapri PowerShell.
2. **graphify**, con il supporto per i file SQL di Supabase:
   ```powershell
   uv tool install "graphifyy[sql]"
   graphify install
   ```
   `graphify install` copia la skill `/graphify` nella cartella utente di Claude Code. Non serve lanciare `graphify claude install`: quello che scriverebbe nel repo è già qui.
3. **Il grafo del progetto**, dalla cartella del repo:
   ```powershell
   graphify extract . --code-only
   graphify cluster-only . --no-label
   ```
   Ci mette pochi secondi, lavora solo in locale e non usa token. Il risultato va in `graphify-out/`, che non viene committato. Dopo ogni `git pull` lancia `graphify update .` (Claude lo fa da solo dopo le sue modifiche).
4. **Ponytail**: apri Claude Code nella cartella del repo. Siccome .claude/settings.json lo attiva, Claude Code ti chiede di fidarti del marketplace `ponytail` e di installare il plugin: accetta. Se non te lo chiede, scrivi in Claude Code, uno alla volta:
   ```
   /plugin marketplace add DietrichGebert/ponytail
   /plugin install ponytail@ponytail
   ```
   Il plugin usa Node.js per i suoi hook: se `node --version` in PowerShell non risponde, installalo con `winget install OpenJS.NodeJS.LTS`.

Comandi utili di Ponytail: `/ponytail lite|full|ultra|off` per l'intensità, `/ponytail-review` per rivedere le modifiche, `/ponytail-audit` per un controllo di tutto il repo.

## Sessioni cloud (Claude app / claude.ai)

Non serve installare nulla. All'avvio, `.claude/hooks/session-start.sh` installa graphify, costruisce il grafo (pochi secondi) e carica le regole Ponytail da `.claude/ponytail-rules.md`. Sul PC lo script non fa niente.

## Sicurezza (verificata il 2026-11-20)

- **Ponytail** 5.3.3, licenza MIT. È un prompt (skill) più alcuni hook Node.js che scrivono solo file locali (`~/.config/ponytail/`, il livello scelto, un CSV con costi e token per la "band" in Claude Code). Unica chiamata di rete: un webhook opzionale, vuoto e spento di default. Nessun eseguibile, nessuna telemetria. Lo script `ponytail-map.js` esegue solo `git ls-files` per fare una mappa del repo.
- **graphify** 0.9.113 (pacchetto PyPI `graphifyy`, con due y: è il nome ufficiale indicato nel repo Graphify-Labs). Il codice viene letto in locale con tree-sitter, senza LLM e senza rete. Nessuna telemetria. Documenti e immagini verrebbero mandati a un modello solo con `/graphify` o con una chiave API impostata: per questo qui si usa sempre `--code-only`. Le domande al grafo finiscono in un log locale (`~/.cache/graphify-queries.log`); nel cloud è disattivato.
- Gli hook di graphify in .claude/settings.json danno solo un promemoria a Claude ("usa il grafo"), non bloccano niente, e se graphify non è installato non fanno nulla.

## Risparmio stimato

Misurato su questo repo (78 file, circa 586.000 caratteri tra `src/` e `supabase/`, cioè circa 150.000 token):

| Domanda | Risposta di `graphify query` | File che contengono la parola chiave |
|---|---|---|
| Check-in kiosk con QR | ~6.500 caratteri (~1.600 token) | 7 file, ~54.000 caratteri (~13.000 token) |
| Approvazione iscrizioni | ~24.000 caratteri (~6.000 token) | 15 file, ~178.000 caratteri (~44.000 token) |
| Notifiche push | ~6.500 caratteri (~1.600 token) | 15 file, ~182.000 caratteri (~45.000 token) |

In pratica Claude non legge tutti quei file, ma ne apre parecchi per orientarsi. Stima onesta: nella fase di esplorazione (capire dove sta una cosa e come è collegata) il risparmio va dal 50 all'80%; quando si modifica il codice i file vanno comunque letti, quindi su un compito completo il risparmio realistico è tra il 20 e il 40%. Ponytail, secondo i benchmark del suo autore, riduce i token in uscita di circa il 45% e il codice scritto di circa la metà.

I sotto-agenti costano meno per token (Haiku e Sonnet), ma ognuno riparte da zero: conviene usarli per ricerche ampie o compiti isolati, non per piccole modifiche.
