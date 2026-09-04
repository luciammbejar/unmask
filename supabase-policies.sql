-- UNMASK V0.2: permisos mínimos para la prueba multijugador.
-- IMPORTANTE: esta versión usa acceso anónimo. No la consideres producción todavía.
-- Más adelante sustituiremos estas políticas por una arquitectura más segura.

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.messages enable row level security;
alter table public.questions enable row level security;
alter table public.guesses enable row level security;

drop policy if exists "games anon all" on public.games;
drop policy if exists "players anon all" on public.players;
drop policy if exists "messages anon all" on public.messages;
drop policy if exists "questions anon all" on public.questions;
drop policy if exists "guesses anon all" on public.guesses;

create policy "games anon all" on public.games for all to anon using (true) with check (true);
create policy "players anon all" on public.players for all to anon using (true) with check (true);
create policy "messages anon all" on public.messages for all to anon using (true) with check (true);
create policy "questions anon all" on public.questions for all to anon using (true) with check (true);
create policy "guesses anon all" on public.guesses for all to anon using (true) with check (true);
