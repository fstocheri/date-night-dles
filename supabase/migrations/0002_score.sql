-- Quiz games (Date Night Dozen) record a points score alongside their answers.
alter table public.game_records add column if not exists score int;
