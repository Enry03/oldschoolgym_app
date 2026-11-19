insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','enricodelprincipemain@gmail.com','{"first_name":"Enrico"}'),
 ('00000000-0000-0000-0000-00000000000c','old@client.it','{"first_name":"Old"}'),
 ('00000000-0000-0000-0000-00000000000e','rec@gym.it','{"first_name":"Rec"}');
update public.profiles set role='reception' where id='00000000-0000-0000-0000-00000000000e';
insert into public.exercises(name) values ('Squat');
