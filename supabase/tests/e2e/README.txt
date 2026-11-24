Test end-to-end di diario, progressi, avvisi, traguardi e messaggi (0017). Mai contro produzione.
1) docker: supabase/postgres, supabase/gotrue e postgrest/postgrest in rete comune (segreto JWT condiviso),
   tabelle minime storage.buckets/objects + storage.foldername, poi migrazioni 0001-0017.
2) node gateway.mjs (porta 54321): /auth/v1 -> GoTrue, /rest/v1 -> PostgREST, /storage/v1 finto che rispetta le RLS.
3) .env.local con VITE_SUPABASE_URL=http://localhost:54321 e la chiave anon locale; npx vite --port 5173.
4) utenti admin/trainer/cliente1/cliente2@e2e.it (password Palestra2026!) approvati, scheda di cliente1 di 45 giorni,
   panca 80 kg 7 giorni prima; poi: node e2e_cliente.cjs e node e2e_staff.cjs (NODE_PATH = npm root -g per playwright).
