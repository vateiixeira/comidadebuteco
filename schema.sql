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
--
-- TRADE-OFF ACEITO: qualquer pessoa com a URL do app pode, via REST do
-- Supabase, ler/criar/alterar/apagar avaliações em nome de qualquer
-- telefone cadastrado. Não há prova de posse do número (sem OTP).
-- OK pra esse caso de 5 amigos; NÃO use em produção real nem coloque
-- nome verdadeiro no cadastro (a UI já avisa).
-- Pra fechar de verdade: trocar pelo auth nativo do Supabase (OTP SMS)
-- e amarrar as policies em auth.uid() / auth.jwt()->>'phone'.
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
