# Check-in con QR sul tablet all'ingresso

## Come funziona

1. All'ingresso c'è un tablet Samsung sempre acceso e in carica, che mostra la pagina `/kiosk`.
2. Il tablet mostra un QR che **cambia ogni 30 secondi** ed è **valido una sola volta**.
3. Il cliente apre l'app, tocca il pulsante centrale **Entra**, inquadra il QR con la fotocamera posteriore.
4. Il server controlla: QR valido e non scaduto, account attivo e **approvato dall'admin**, abbonamento valido, certificato medico **verificato** (se richiesto nelle impostazioni). Nei pacchetti a ingressi scala un ingresso. Se la persona è già entrata nelle ultime 3 ore non scala niente.
5. In tempo reale il tablet diventa **verde** con foto e nome ("Ciao Mario R.!"), **giallo** se era già entrato, **rosso** se l'ingresso non è consentito ("passa in reception"). Il motivo preciso del rifiuto compare solo sul telefono del cliente.
6. Se qualcosa non va (fotocamera rotta, telefono scarico, internet assente) lo staff fa il check-in manuale da **Check-in** nel pannello (ricerca per nome o scanner del pass personale).

## Collegare il tablet (admin)

1. Dall'app, come admin: **Altro → Tablet ingresso (QR) → Collega un tablet**.
2. Compare un QR con un link: inquadralo con la fotocamera del tablet e aprilo in **Chrome**. Il link si vede una sola volta e non va mandato a nessuno.
3. Il tablet resta collegato finché non premi **Scollega** (da usare subito se il tablet viene perso o rubato, poi se ne collega uno nuovo).
4. Nella stessa pagina vedi se il tablet è online e quanti ingressi ha registrato oggi.

## Preparare il tablet Samsung (modalità chiosco)

**Una volta sola, nelle Impostazioni del tablet:**

- **Schermo sempre acceso in carica**: Impostazioni → Info sul tablet → Informazioni sul software → tocca 7 volte *Numero build* (sblocca le Opzioni sviluppatore). Poi Impostazioni → Opzioni sviluppatore → attiva **Rimani attivo** (lo schermo non si spegne mai mentre è in carica). La pagina chiede anche al browser di tenere lo schermo acceso.
- **Proteggere la batteria** (sempre attaccato alla corrente): Impostazioni → Batteria → Altre impostazioni batteria → **Proteggi batteria** (si ferma all'80-85%).
- **Niente blocco schermo**: Impostazioni → Schermata di blocco → Tipo di blocco schermo → *Scorrimento* o *Nessuno*.
- **Niente notifiche a schermo**: attiva *Non disturbare* senza orario di fine.
- **Volume** a metà per sentire il "bip" di conferma.
- **Blocca app** (impedisce ai clienti di uscire dalla pagina): Impostazioni → Sicurezza e privacy → Altre impostazioni di sicurezza → **Blocca app** (in alcune versioni *Blocca finestre*) → attiva, e attiva anche *Richiedi PIN prima di sbloccare*.

**Ogni volta che il tablet si riavvia:**

1. Apri Chrome sulla pagina del kiosk (resta salvata: basta riaprire la scheda o `oldschoolgympineto.it/kiosk`).
2. Tocca l'icona a quadrato in alto a destra (o tocca due volte lo schermo) per lo **schermo intero**.
3. Apri le app recenti, tocca l'icona di Chrome sopra l'anteprima → **Blocca questa app**.
4. Per uscire: tieni premuti insieme *Indietro* e *Recenti*, poi inserisci il PIN.

Consiglio: supporto a muro o da banco all'altezza del petto, lontano da finestre (i riflessi rendono il QR difficile da leggere), luminosità alta. Se si vuole un riavvio completamente automatico, l'alternativa è l'app *Fully Kiosk Browser* (licenza a pagamento, pochi euro) che riapre da sola la pagina.

La pagina si ricarica da sola ogni notte alle 4 per prendere gli aggiornamenti dell'app.

## Analisi di sicurezza e abusi

Analisi fatta con la skill security-audit (modalità mirata sulla nuova funzione), con test sul database in locale.

| Scenario di abuso | Cosa succede | Rischio residuo |
|---|---|---|
| **Check-in da casa** | Serve il QR che si vede solo sul tablet e cambia ogni 30 s. Un codice vecchio viene rifiutato ("QR scaduto"). | Un complice in palestra potrebbe fotografare il QR e mandarlo in tempo reale a un amico a casa (entro ~40 s). Effetto: l'amico si scala **un proprio** ingresso (nessun guadagno con l'abbonamento a tempo) e sul tablet compare la sua foto con nessuno davanti, quindi lo staff lo nota. Il codice poi è bruciato. Rischio basso. |
| **Screenshot / replay** | Ogni QR vale una volta: dopo il primo ingresso valido ne esce subito un altro. Riusarlo dà "QR già usato". | Nessuno. |
| **Persona sbagliata** (Mario presta account e password al cugino) | Il tablet mostra **grande la foto** dell'account che entra; se due persone usano lo stesso account nelle stesse 3 ore, la seconda volta il tablet diventa giallo "già entrato". | Senza riconoscimento facciale non si può escludere del tutto: dipende dall'occhio dello staff. **Consiglio**: rendere obbligatoria la foto profilo (fatta in reception) prima di approvare l'account. |
| **Account non approvato, disattivato, abbonamento scaduto, certificato non verificato** | Tutti i controlli sono in un'unica funzione lato server (`private.do_checkin`), usata sia dal tablet sia dallo staff. L'app non può saltarli. | Nessuno (testati). |
| **Tablet rubato o link di collegamento divulgato** | Il segreto del tablet esiste solo sul tablet (nel database c'è solo un'impronta). L'admin lo **scollega** con un tocco e da quel momento non funziona più. Il tablet non ha login e non può leggere dati dei clienti: vede solo nome, iniziale del cognome e foto di chi entra in quel momento. | Finché non viene scollegato, chi ha il link potrebbe mostrare il QR altrove. Per questo il link si vede una volta sola e la pagina admin mostra quando il tablet è stato visto l'ultima volta. |
| **Doppio ingresso scalato** (due richieste in contemporanea) | Gli ingressi della stessa persona vengono messi in fila nel database: niente doppio scalo. | Nessuno. |
| **Indovinare i codici** | QR da 128 bit casuali, segreto tablet da 256 bit; dopo 10 tentativi falliti in 10 minuti il cliente viene bloccato temporaneamente. | Nessuno. |
| **QR malevolo** (qualcuno attacca un adesivo con un altro QR) | L'app accetta solo codici del formato OldSchool e non apre link. | Un adesivo sopra lo schermo darebbe solo "QR non riconosciuto". |
| **Privacy** | Sul tablet, visibile a tutti: solo nome + iniziale e un generico "passa in reception". Gli esiti del tablet e i tentativi si cancellano dopo 1 giorno. | Nessuno. |
| **Pass personale (vecchio QR fisso)** | Resta solo come riserva da mostrare allo staff, che vede nome e foto prima di confermare. | È statico: uno screenshot funziona, ma solo davanti allo staff. |

Possibili aggiunte future (non incluse, da decidere): controllo che il telefono sia sulla rete Wi-Fi della palestra o vicino in GPS (facilmente aggirabile e più invasivo per la privacy), foto profilo obbligatoria all'approvazione.
