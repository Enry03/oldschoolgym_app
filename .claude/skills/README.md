# Skill del progetto

Copiate a mano (lette e verificate prima), così funzionano anche nelle sessioni cloud senza installare plugin.

| Skill | Origine | Versione | Licenza |
| --- | --- | --- | --- |
| `motion` | github.com/motiondivision/ai-kit, cartella `plugins/motion/skills/motion` | commit 1e42494 (motion-ai 14.2.0) | MIT |
| `unslop` | github.com/heydamir/unslop, cartella `skills/unslop` | commit 620163e | CC BY 4.0, di Damir Sokolovsky (@heydamir): tenere i crediti |

Note:
- `motion`: le best practice funzionano offline. Ricerca nei documenti ed easing usano il server MCP gratuito `https://mcp.motion.dev` (non configurato qui). Le parti Motion+ sono a pagamento: non usarle senza l'ok di Enrico.
- `unslop`: gli script in `scripts/` (snapshot e video "story") servono solo su richiesta e richiedono Playwright e ffmpeg; non lanciarli di routine. Niente generazione di immagini a pagamento senza l'ok di Enrico.
- Per aggiornarle: riclonare il repo d'origine, rileggere le differenze, ricopiare la cartella.
