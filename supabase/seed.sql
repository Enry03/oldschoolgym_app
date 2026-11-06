-- Dati dimostrativi OldSchool Gym (fittizi, modificabili dall'admin)

insert into public.plans (name, description, kind, duration_days, entries, price_cents, highlight, features, sort) values
 ('Mensile', 'Sala pesi e corsi per 30 giorni', 'time', 30, null, 4500, false, array['Sala pesi illimitata','Tutti i corsi','App con scheda e progressi'], 1),
 ('Trimestrale', 'Tre mesi di allenamento senza pensieri', 'time', 90, null, 11900, true, array['Sala pesi illimitata','Tutti i corsi','Scheda personalizzata','1 check-up con il trainer'], 2),
 ('Annuale', 'Il miglior prezzo per chi fa sul serio', 'time', 365, null, 39900, false, array['Tutto incluso','4 check-up all''anno','Sospensione fino a 30 giorni','Maglietta OldSchool'], 3),
 ('Carnet 10 ingressi', 'Per chi si allena quando può', 'entries', 120, 10, 6000, false, array['10 ingressi in 4 mesi','Sala pesi e corsi'], 4),
 ('Personal x5', 'Cinque sedute 1 a 1 con un trainer', 'entries', 60, 5, 15000, false, array['5 sedute da 60''','Programma su misura'], 5);

insert into public.courses (name, description, color, level, duration_min, capacity) values
 ('Boxe', 'Tecnica, sacco e sparring controllato. Lo spirito old school al 100%.', '#E8553D', 'Tutti i livelli', 60, 16),
 ('Functional', 'Circuiti ad alta intensità a corpo libero e con attrezzi.', '#F5C518', 'Intermedio', 50, 14),
 ('Pump', 'Bilanciere e musica: tonificazione total body.', '#2B5BA8', 'Tutti i livelli', 55, 18),
 ('Kickboxing', 'Calci, pugni e tanto cardio.', '#C99A06', 'Intermedio', 60, 14),
 ('Pilates', 'Core, postura e mobilità.', '#3DDC97', 'Principiante', 50, 12),
 ('Spinning', 'Bike indoor a ritmo di musica anni ''80.', '#5AA9FF', 'Tutti i livelli', 45, 20);

-- Lezioni ricorrenti per le prossime 4 settimane
with slots(course, dow, hh, mm) as (values
  ('Boxe',1,19,0),('Boxe',3,19,0),('Boxe',5,19,0),
  ('Functional',1,7,30),('Functional',3,13,0),('Functional',5,18,0),
  ('Pump',2,18,30),('Pump',4,18,30),
  ('Kickboxing',2,20,0),('Kickboxing',4,20,0),
  ('Pilates',2,10,0),('Pilates',4,10,0),('Pilates',6,10,30),
  ('Spinning',1,13,0),('Spinning',3,18,0),('Spinning',6,9,30)
), days as (
  select d::date as day from generate_series(current_date, current_date + 27, interval '1 day') d
)
insert into public.sessions (course_id, kind, title, starts_at, ends_at, capacity, room)
select c.id, 'course', c.name,
  ((d.day + make_time(s.hh, s.mm, 0)) at time zone 'Europe/Rome'),
  ((d.day + make_time(s.hh, s.mm, 0)) at time zone 'Europe/Rome') + make_interval(mins => c.duration_min),
  c.capacity,
  case when c.name in ('Boxe','Kickboxing') then 'Ring' when c.name = 'Spinning' then 'Sala bike' else 'Sala corsi' end
from slots s
join public.courses c on c.name = s.course
join days d on extract(isodow from d.day) = s.dow;

insert into public.sessions (kind, title, description, starts_at, ends_at, capacity, room) values
 ('event', 'Open Day Old School', 'Porta chi vuoi: lezioni di prova gratuite, musica anni ''80 e buffet proteico.', ((current_date + 10 + time '17:00') at time zone 'Europe/Rome'), ((current_date + 10 + time '21:00') at time zone 'Europe/Rome'), 80, 'Tutta la palestra'),
 ('event', 'Seminario: tecnica dello squat', 'Un'' ora con il coach per sistemare la tecnica dei fondamentali.', ((current_date + 6 + time '11:00') at time zone 'Europe/Rome'), ((current_date + 6 + time '12:30') at time zone 'Europe/Rome'), 12, 'Sala pesi');

insert into public.exercises (name, muscle_group, equipment, description) values
 ('Panca piana con bilanciere','Petto','Bilanciere','Scapole addotte, piedi a terra, bilanciere al petto e spinta controllata.'),
 ('Spinte manubri panca inclinata','Petto','Manubri',null),
 ('Croci ai cavi','Petto','Cavi',null),
 ('Trazioni alla sbarra','Dorso','Sbarra',null),
 ('Lat machine avanti','Dorso','Macchina',null),
 ('Rematore con bilanciere','Dorso','Bilanciere',null),
 ('Pulley basso','Dorso','Cavi',null),
 ('Stacco da terra','Dorso','Bilanciere','Schiena neutra, spinta con le gambe, bilanciere vicino alle tibie.'),
 ('Military press','Spalle','Bilanciere',null),
 ('Alzate laterali','Spalle','Manubri',null),
 ('Face pull','Spalle','Cavi',null),
 ('Curl con bilanciere','Braccia','Bilanciere',null),
 ('Curl a martello','Braccia','Manubri',null),
 ('French press','Braccia','Bilanciere EZ',null),
 ('Pushdown ai cavi','Braccia','Cavi',null),
 ('Squat con bilanciere','Gambe','Bilanciere','Discesa controllata fino al parallelo, ginocchia in linea con le punte.'),
 ('Leg press','Gambe','Macchina',null),
 ('Affondi camminati','Gambe','Manubri',null),
 ('Leg curl','Gambe','Macchina',null),
 ('Calf raise in piedi','Gambe','Macchina',null),
 ('Hip thrust','Glutei','Bilanciere',null),
 ('Plank','Addome','Corpo libero',null),
 ('Crunch ai cavi','Addome','Cavi',null),
 ('Russian twist','Addome','Palla medica',null),
 ('Corda per saltare','Cardio','Corda','Il riscaldamento dei pugili: 3 round da 3 minuti.'),
 ('Sacco pesante','Cardio','Sacco','Round da 3 minuti, combinazioni jab-diretto-gancio.'),
 ('Burpees','Full body','Corpo libero',null),
 ('Kettlebell swing','Full body','Kettlebell',null);

-- Modelli di scheda
with t as (
  insert into public.workout_plans (title, goal, notes, is_template) values
   ('Full Body Principiante', 'Tonificazione', 'Riscaldamento 10'' cyclette. 3 volte a settimana.', true),
   ('Push Pull Legs', 'Ipertrofia', 'Ciclo di 6 settimane. Aumenta i carichi quando chiudi tutte le serie.', true),
   ('Boxer Conditioning', 'Boxe', 'Preparazione atletica in stile pugile.', true)
  returning id, title
)
insert into public.workout_plan_items (plan_id, day_label, exercise_name, sets, reps, rest_sec, sort)
select t.id, x.day_label, x.ex, x.sets, x.reps, x.rest, x.ord from t join (values
 ('Full Body Principiante','Giorno A','Squat con bilanciere',3,'12',90,1),
 ('Full Body Principiante','Giorno A','Panca piana con bilanciere',3,'10',90,2),
 ('Full Body Principiante','Giorno A','Lat machine avanti',3,'12',75,3),
 ('Full Body Principiante','Giorno A','Alzate laterali',3,'15',60,4),
 ('Full Body Principiante','Giorno A','Plank',3,'40"',45,5),
 ('Push Pull Legs','Push','Panca piana con bilanciere',4,'8',120,1),
 ('Push Pull Legs','Push','Spinte manubri panca inclinata',3,'10',90,2),
 ('Push Pull Legs','Push','Military press',3,'8',120,3),
 ('Push Pull Legs','Push','Pushdown ai cavi',3,'12',60,4),
 ('Push Pull Legs','Pull','Trazioni alla sbarra',4,'max',120,5),
 ('Push Pull Legs','Pull','Rematore con bilanciere',4,'8',90,6),
 ('Push Pull Legs','Pull','Face pull',3,'15',60,7),
 ('Push Pull Legs','Pull','Curl con bilanciere',3,'10',60,8),
 ('Push Pull Legs','Legs','Squat con bilanciere',4,'6-8',150,9),
 ('Push Pull Legs','Legs','Leg press',3,'12',90,10),
 ('Push Pull Legs','Legs','Leg curl',3,'12',60,11),
 ('Push Pull Legs','Legs','Calf raise in piedi',4,'15',45,12),
 ('Boxer Conditioning','Giorno A','Corda per saltare',3,'3''',60,1),
 ('Boxer Conditioning','Giorno A','Sacco pesante',5,'3''',60,2),
 ('Boxer Conditioning','Giorno A','Burpees',4,'15',45,3),
 ('Boxer Conditioning','Giorno A','Russian twist',3,'30',30,4)
) as x(tpl, day_label, ex, sets, reps, rest, ord) on x.tpl = t.title;

update public.workout_plan_items i set exercise_id = e.id from public.exercises e where e.name = i.exercise_name and i.exercise_id is null;

insert into public.announcements (title, body, category, is_pinned, audience) values
 ('Benvenuti nella nuova app!', 'Da oggi prenoti i corsi, mostri il QR all''ingresso e segui la tua scheda direttamente dal telefono. Installa l''app sulla schermata Home per averla sempre a portata di mano.', 'News', true, 'all'),
 ('Open Day Old School', 'Una serata di lezioni gratuite, musica anni ''80 e sfide al sacco. Porta un amico: per ogni iscritto c''è un regalo.', 'Evento', false, 'all'),
 ('Nuovo corso di Kickboxing', 'Martedì e giovedì alle 20:00 sul ring. Posti limitati: prenota dall''app.', 'Corsi', false, 'all'),
 ('Promo autunno: -15% sul trimestrale', 'Fino a fine mese usa il codice AUTUNNO15 in reception.', 'Promo', false, 'all');

insert into public.discount_codes (code, description, percent, valid_until) values
 ('AUTUNNO15', 'Promo autunno sul trimestrale', 15, current_date + 30),
 ('AMICO10', 'Sconto per chi viene con il codice amico', 10, null);

insert into public.products (name, category, price_cents, stock) values
 ('Proteine whey 30 g', 'Integratori', 300, 40),
 ('Barretta proteica', 'Snack', 250, 60),
 ('Acqua naturale 50 cl', 'Bevande', 100, 120),
 ('Sali minerali', 'Bevande', 200, 48),
 ('T-shirt OldSchool', 'Merchandising', 2000, 25),
 ('Guantoni 12 oz', 'Accessori', 3500, 8),
 ('Fasce da boxe', 'Accessori', 800, 30);
