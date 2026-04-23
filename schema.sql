-- =====================================================================
-- Comida di Buteco — Schema do banco
-- Roda esse SQL no Supabase em "SQL Editor" antes de usar o app.
-- =====================================================================

create table if not exists usuarios (
  telefone text primary key check (telefone ~ '^\d{11}$'),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table if not exists avaliacoes (
  telefone text not null references usuarios(telefone) on delete cascade,
  prato_id text not null,
  nota int not null check (nota between 1 and 5),
  obs text not null default '',
  atualizado_em timestamptz not null default now(),
  primary key (telefone, prato_id)
);

create index if not exists idx_avaliacoes_telefone on avaliacoes(telefone);

-- ---------------------------------------------------------------------
-- Row Level Security
-- Habilitado com políticas abertas pra anon (acesso público sem login).
-- OK pra esse caso de 5 amigos compartilhando, NÃO use em produção real.
-- ---------------------------------------------------------------------
alter table usuarios enable row level security;
alter table avaliacoes enable row level security;

drop policy if exists usuarios_anon_all on usuarios;
create policy usuarios_anon_all on usuarios
  for all to anon
  using (true) with check (true);

drop policy if exists avaliacoes_anon_all on avaliacoes;
create policy avaliacoes_anon_all on avaliacoes
  for all to anon
  using (true) with check (true);
