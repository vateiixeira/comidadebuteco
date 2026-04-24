# Comida di Buteco — Tracker

App pequeno pra marcar quais botecos do **Comida di Buteco MOC 2026** você (e seus amigos) já visitaram, com nota de 1 a 5.

- Sem build, sem framework no servidor
- Hospedagem: GitHub Pages (estático)
- Banco: Supabase (Postgres com REST + RLS)
- Login: só celular (BR, +55), sem senha

---

## 1. Subir o banco no Supabase

1. Cria conta em https://supabase.com (free tier serve folgado pra 5 usuários)
2. Cria um projeto novo. Escolhe a região mais perto (São Paulo)
3. Vai em **SQL Editor** → **New query**
4. Cola o conteúdo de [`schema.sql`](./schema.sql) e clica em **Run**
5. Vai em **Settings → API** e copia:
   - **Project URL** (ex: `https://abcdefgh.supabase.co`)
   - **anon public key** (a chave longa que começa com `eyJ...`)

> A `anon key` é segura pra ficar pública — quem protege os dados é o RLS do Postgres.

---

## 2. Configurar o app

Abre `config.js` e cola os valores:

```js
window.CDB_CONFIG = {
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGc...',
};
```

---

## 3. Subir no GitHub Pages

```bash
git init
git add .
git commit -m "Comida di Buteco MOC tracker"
git branch -M main
git remote add origin git@github.com:SEU_USER/comida-di-buteco-moc.git
git push -u origin main
```

No GitHub:
- **Settings → Pages**
- **Source:** Deploy from a branch
- **Branch:** `main` / `/ (root)`
- Salvar e esperar 1–2 min

URL final: `https://SEU_USER.github.io/comida-di-buteco-moc/`

---

## Como funciona

- Usuário entra com celular (DDD + 9 dígitos, país fixo +55)
- Se for primeira vez, pede o nome e cria registro em `usuarios`
- Carrega todas as avaliações daquele telefone
- Lista mostra: faltam / já fui / perto / galera (feed das últimas avaliações de todo mundo)
- Toca num card → modal com 5 estrelas e campo de observação
- Salvar faz `upsert` em `avaliacoes`

LocalStorage guarda só o último telefone usado (auto-login no mesmo device). Os dados em si ficam todos no Supabase.

---

## Estrutura

```
.
├── index.html       UI completa (Vue 3 via CDN, Tailwind via CDN)
├── app.js           Lógica da aplicação
├── config.js        Suas chaves do Supabase ← EDITAR
├── dishes.js        Os 20 botecos (dados estáticos)
├── schema.sql       DDL do banco
└── README.md        Esse arquivo
```

---

## Customizar pra outras edições/cidades

Os 20 botecos estão hardcoded em `dishes.js`. Pra trocar (próxima edição, outra cidade):

1. Edita o array `window.CDB_DISHES`
2. Mantém os campos: `id`, `boteco`, `prato`, `descricao`, `endereco`, `foto`
3. Os `id` precisam ser únicos e estáveis (são chave estrangeira nas avaliações)

Pra resetar avaliações antigas no Supabase:
```sql
delete from avaliacoes;
-- ou seletivo:
delete from avaliacoes where prato_id not in ('balanca-vento', 'bar-do-kal', ...);
```
