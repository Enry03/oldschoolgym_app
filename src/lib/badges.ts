// Traguardi: i codici li assegna il database (migrazione 0017), qui solo testi e ordine.
export interface BadgeDef {
  code: string
  title: string
  desc: string
  group: 'Ingressi' | 'Costanza' | 'Diario' | 'Record' | 'Progressi'
}

export const BADGES: BadgeDef[] = [
  { code: 'ingressi_1', title: 'Primo round', desc: 'Il primo ingresso in palestra', group: 'Ingressi' },
  { code: 'ingressi_10', title: 'Dieci riprese', desc: '10 ingressi', group: 'Ingressi' },
  { code: 'ingressi_25', title: 'Peso medio', desc: '25 ingressi', group: 'Ingressi' },
  { code: 'ingressi_50', title: 'Peso massimo', desc: '50 ingressi', group: 'Ingressi' },
  { code: 'ingressi_100', title: 'Campione', desc: '100 ingressi', group: 'Ingressi' },
  { code: 'ingressi_200', title: 'Leggenda della palestra', desc: '200 ingressi', group: 'Ingressi' },
  { code: 'costanza_4', title: 'Occhio della tigre', desc: '4 settimane di fila con almeno 2 ingressi', group: 'Costanza' },
  { code: 'diario_1', title: 'Primo allenamento segnato', desc: 'Hai segnato pesi e ripetizioni sulla scheda', group: 'Diario' },
  { code: 'diario_20', title: 'Diario di ferro', desc: '20 allenamenti segnati sul diario', group: 'Diario' },
  { code: 'record_1', title: 'Primo record', desc: 'Hai battuto il tuo peso massimo su un esercizio', group: 'Record' },
  { code: 'record_10', title: "Cintura d'oro", desc: '10 record personali', group: 'Record' },
  { code: 'misure_1', title: 'Si parte', desc: 'La prima misurazione: il punto di partenza', group: 'Progressi' },
]
