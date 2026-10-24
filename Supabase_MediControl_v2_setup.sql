-- MediControl v2.0.0 — esquema inicial para PROJETO SUPABASE SEPARADO
-- Execute no SQL Editor do projeto dedicado ao MediControl.
-- A aplicação guarda medicamentos, rotinas, histórico de doses e historicosMedicamentos no JSONB `data`.
create table if not exists public.medication_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"medicamentos":[],"rotinas":[],"historico":[],"historicosMedicamentos":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.medication_data enable row level security;
drop policy if exists "MediControl read own data" on public.medication_data;
drop policy if exists "MediControl insert own data" on public.medication_data;
drop policy if exists "MediControl update own data" on public.medication_data;
create policy "MediControl read own data" on public.medication_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "MediControl insert own data" on public.medication_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "MediControl update own data" on public.medication_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.medication_data to authenticated;
