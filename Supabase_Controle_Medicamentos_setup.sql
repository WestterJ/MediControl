-- MediControl: tabela de dados e políticas de segurança (RLS)
-- Execute este script no Supabase > SQL Editor > New query > Run.
create table if not exists public.medication_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"medicamentos":[],"rotinas":[],"historico":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.medication_data enable row level security;

-- Remove políticas com estes nomes caso o script seja executado novamente.
drop policy if exists "Users can read own medication data" on public.medication_data;
drop policy if exists "Users can insert own medication data" on public.medication_data;
drop policy if exists "Users can update own medication data" on public.medication_data;

create policy "Users can read own medication data"
  on public.medication_data for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own medication data"
  on public.medication_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own medication data"
  on public.medication_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.medication_data to authenticated;
