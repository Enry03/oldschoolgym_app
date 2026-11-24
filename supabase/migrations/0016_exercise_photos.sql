-- Foto degli esercizi: fino a 4 foto per esercizio (es. posizione iniziale e finale), caricate una volta
-- nella libreria e mostrate in ogni scheda che usa l'esercizio. I file stanno nel bucket pubblico "media"
-- (cartella exercises/), che solo lo staff può scrivere o cancellare (policy media_write/media_delete).
alter table public.exercises add column if not exists images text[] not null default '{}';

update public.exercises set images = array[image_url]
  where image_url is not null and image_url <> '' and cardinality(images) = 0;

alter table public.exercises drop constraint if exists exercises_images_max;
alter table public.exercises add constraint exercises_images_max check (cardinality(images) <= 4);

-- solo link web veri (niente "javascript:" o simili, che diventerebbero link pericolosi nell'app)
alter table public.exercises drop constraint if exists exercises_video_url_http;
alter table public.exercises add constraint exercises_video_url_http
  check (video_url is null or video_url ~* '^https?://[^\s]+$') not valid;
