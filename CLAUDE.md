# OldSchool Gym — istruzioni per Claude

Rispondi in italiano. Web app PWA per la palestra OldSchool Gym (React + Vite + TypeScript, Supabase, Vercel).

## Risparmio token

Questo repo usa due strumenti per spendere meno token. La guida completa è in docs/risparmio-token.md.

### Ponytail (stile delle modifiche)

Sul PC arriva dal plugin `ponytail@ponytail` (attivato in .claude/settings.json); nelle sessioni cloud le sue regole vengono caricate all'avvio da .claude/ponytail-rules.md. In breve: la modifica più piccola che risolve tutto, riusa quello che c'è già, niente dipendenze o astrazioni non richieste, ma mai tagliare validazione, sicurezza, gestione errori o accessibilità.

### graphify (grafo del codice)

Il grafo sta in graphify-out/ (non versionato). Nelle sessioni cloud si costruisce da solo all'avvio; sul PC si crea con `graphify extract . --code-only` (gratis, in locale). Non usare `/graphify .` senza motivo: manda anche i documenti al modello e consuma token.

- Quando graphify-out/graph.json esiste, esegui `graphify query "<domanda>"` prima della prima grep, ricerca o lettura di file sorgente per una domanda sul codice, e metti questa regola nel prompt di ogni sotto-agente che esplora il codice. Leggi i file grezzi solo per le righe che il grafo o una lettura precedente hanno già localizzato. Usa `graphify path "<A>" "<B>"` per le relazioni e `graphify explain "<concetto>"` per un concetto preciso. Per un testo sotto un titolo Markdown, `graphify section "<titolo>"` lo stampa senza aprire il file.
- Leggi graphify-out/GRAPH_REPORT.md solo per una revisione ampia dell'architettura o quando query/path/explain non bastano.
- Dopo aver modificato il codice esegui `graphify update .` per tenere il grafo aggiornato (solo AST, nessun costo API).
- Se graphify non è installato, lavora normalmente con grep e lettura dei file.

### Sotto-agenti per modello

In .claude/agents ci sono tre sotto-agenti. Ogni sotto-agente riparte da zero e deve rileggere il contesto, quindi usali solo quando conviene davvero:

- `esploratore` (Haiku): ricerche ampie in sola lettura quando serve solo la conclusione, non il contenuto dei file.
- `sviluppatore` (Sonnet): modifiche al frontend ben definite e circoscritte, con i file già noti.
- `sicurezza-db` (Opus): migrazioni SQL, RLS, autenticazione, approvazione iscrizioni, check-in, pagamenti e revisioni di sicurezza.

Per compiti piccoli o quando hai già il contesto, lavora direttamente senza sotto-agenti.

## Regole del progetto

- Le scritture sul database Supabase non passano dal connettore MCP: prepara un file .sql da incollare nel SQL Editor e salvalo in supabase/migrations col numero successivo.
- Ogni nuovo account deve essere approvato dall'admin prima di usare l'app.
- Non toccare altri progetti di Enrico su Vercel o Supabase.
