# OldSchool Gym — web app

PWA della palestra OldSchool Gym di Pineto (TE): area clienti, area staff (admin, trainer, reception) e sito pubblico.

- **Frontend**: React 19 + Vite + Tailwind 4 + framer-motion, installabile come app (PWA).
- **Backend**: Supabase (database con sicurezza per ruolo, storage, realtime, edge functions, promemoria automatici).
- **Hosting**: Vercel.

## Sviluppo

```bash
cp .env.example .env   # URL e chiave pubblica Supabase
npm install
npm run dev
```

Le migrazioni del database sono in `supabase/migrations`, i dati dimostrativi in `supabase/seed.sql`.
Il primo account registrato con l'email dell'amministratore riceve automaticamente il ruolo admin.
