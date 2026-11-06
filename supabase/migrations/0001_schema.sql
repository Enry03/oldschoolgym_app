-- OldSchool Gym: schema base
create extension if not exists pgcrypto with schema extensions;

-- ===== Tipi =====
create type public.user_role as enum ('admin','trainer','reception','client');
create type public.plan_kind as enum ('time','entries');
create type public.membership_status as enum ('active','suspended','expired','cancelled');
create type public.payment_method as enum ('cash','card','transfer','other');
create type public.payment_status as enum ('paid','pending');
create type public.session_kind as enum ('course','event','open','personal');
create type public.booking_status as enum ('booked','waitlist','cancelled','attended','no_show');
create type public.audience as enum ('all','clients','staff');
create type public.lead_status as enum ('new','contacted','trial','converted','lost');

-- ===== Profili =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'client',
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  birth_date date,
  gender text,
  avatar_url text,
  trainer_id uuid references public.profiles(id) on delete set null,
  qr_token uuid not null default gen_random_uuid() unique,
  consent_privacy boolean not null default false,
  consent_marketing boolean not null default false,
  consent_photos boolean not null default false,
  consent_at timestamptz,
  referral_code text unique default upper(substr(md5(random()::text),1,6)),
  referred_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.profiles(trainer_id);
create index on public.profiles(role);
create index on public.profiles(referred_by);

-- Note interne (solo staff)
create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.client_notes(client_id);
create index on public.client_notes(author_id);

-- ===== Impostazioni palestra (riga singola) =====
create table public.gym_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'OldSchool Gym',
  tagline text default 'Allenati come una volta. Con la tecnologia di oggi.',
  address text default 'Via Nazionale Adriatica 1, 64025 Pineto (TE)',
  phone text default '+39 085 000 0000',
  whatsapp text default '+39 333 000 0000',
  email text default 'info@oldschoolgym.it',
  instagram text default 'oldschoolgym.pineto',
  opening_hours jsonb not null default '[
    {"day":1,"label":"Lunedì","open":"07:00","close":"22:00"},
    {"day":2,"label":"Martedì","open":"07:00","close":"22:00"},
    {"day":3,"label":"Mercoledì","open":"07:00","close":"22:00"},
    {"day":4,"label":"Giovedì","open":"07:00","close":"22:00"},
    {"day":5,"label":"Venerdì","open":"07:00","close":"22:00"},
    {"day":6,"label":"Sabato","open":"09:00","close":"18:00"},
    {"day":0,"label":"Domenica","open":null,"close":null}
  ]'::jsonb,
  cancel_hours int not null default 2,
  max_capacity int not null default 60,
  inactivity_days int not null default 14,
  block_without_certificate boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.gym_settings (id) values (1);

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  reason text not null default 'Chiusura',
  created_at timestamptz not null default now()
);

-- ===== Listino e abbonamenti =====
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  kind public.plan_kind not null default 'time',
  duration_days int,
  entries int,
  price_cents int not null default 0,
  highlight boolean not null default false,
  features text[] not null default '{}',
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  plan_name text not null,
  start_date date not null default current_date,
  end_date date,
  entries_left int,
  status public.membership_status not null default 'active',
  suspended_from date,
  suspended_to date,
  price_cents int not null default 0,
  discount_code text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.memberships(user_id);
create index on public.memberships(plan_id);
create index on public.memberships(created_by);
create index on public.memberships(end_date);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  percent int check (percent between 0 and 100),
  amount_cents int,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,
  description text not null default 'Abbonamento',
  amount_cents int not null,
  method public.payment_method not null default 'cash',
  status public.payment_status not null default 'paid',
  due_date date,
  paid_at timestamptz,
  receipt_number serial,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.payments(user_id);
create index on public.payments(membership_id);
create index on public.payments(created_by);

-- ===== Certificati medici =====
create table public.medical_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'Non agonistico',
  issued_on date,
  expires_on date not null,
  file_path text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.medical_certificates(user_id);

-- ===== Corsi, sessioni, prenotazioni =====
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text not null default '#F5C518',
  level text default 'Tutti i livelli',
  duration_min int not null default 60,
  capacity int not null default 15,
  trainer_id uuid references public.profiles(id) on delete set null,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.courses(trainer_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  kind public.session_kind not null default 'course',
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null default 15,
  trainer_id uuid references public.profiles(id) on delete set null,
  room text default 'Sala principale',
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.sessions(starts_at);
create index on public.sessions(course_id);
create index on public.sessions(trainer_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.booking_status not null default 'booked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);
create index on public.bookings(user_id);
create index on public.bookings(session_id, status);

-- ===== Schede =====
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null default 'Full body',
  equipment text,
  description text,
  video_url text,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  goal text,
  notes text,
  is_template boolean not null default false,
  is_active boolean not null default true,
  starts_on date default current_date,
  ends_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.workout_plans(user_id);
create index on public.workout_plans(created_by);

create table public.workout_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  day_label text not null default 'Giorno A',
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  sets int not null default 3,
  reps text not null default '10',
  rest_sec int default 90,
  load_note text,
  notes text,
  sort int not null default 0
);
create index on public.workout_plan_items(plan_id);
create index on public.workout_plan_items(exercise_id);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_item_id uuid references public.workout_plan_items(id) on delete set null,
  exercise_name text not null,
  performed_on date not null default current_date,
  set_number int not null default 1,
  weight_kg numeric(6,2),
  reps int,
  note text,
  created_at timestamptz not null default now()
);
create index on public.workout_logs(user_id, performed_on);
create index on public.workout_logs(plan_item_id);

-- ===== Misure, obiettivi, foto =====
create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  body_fat_pct numeric(4,1),
  muscle_mass_kg numeric(5,2),
  chest_cm numeric(5,1),
  waist_cm numeric(5,1),
  hips_cm numeric(5,1),
  arm_cm numeric(5,1),
  thigh_cm numeric(5,1),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.measurements(user_id, measured_on);
create index on public.measurements(created_by);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  target_value numeric,
  unit text,
  due_on date,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.goals(user_id);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  taken_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index on public.progress_photos(user_id);

-- ===== Check-in =====
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_at timestamptz not null default now(),
  allowed boolean not null default true,
  reason text,
  staff_id uuid references public.profiles(id) on delete set null
);
create index on public.checkins(user_id, checked_at);
create index on public.checkins(checked_at);
create index on public.checkins(staff_id);

-- ===== Comunicazioni =====
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'News',
  image_url text,
  is_pinned boolean not null default false,
  audience public.audience not null default 'all',
  published_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.announcements(created_by);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  kind text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.messages(sender_id, created_at);
create index on public.messages(recipient_id, created_at);

-- ===== Lead e pass ospite =====
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  source text default 'Passaparola',
  status public.lead_status not null default 'new',
  trial_date date,
  notes text,
  referred_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.leads(referred_by);

-- ===== Prodotti e vendite =====
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Integratori',
  price_cents int not null default 0,
  stock int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity int not null default 1 check (quantity > 0),
  total_cents int not null,
  user_id uuid references public.profiles(id) on delete set null,
  method public.payment_method not null default 'cash',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.sales(product_id);
create index on public.sales(user_id);
create index on public.sales(created_by);

-- ===== Registro attività =====
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  row_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log(created_at desc);
