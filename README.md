# Painel de gastos

Quatro painéis privados — um por pessoa — alimentados por uma folha do Google Sheets.
Cada pessoa abre o seu link e vê **só o que ela deve**. Ninguém vê o total de outro.

```
Google Sheets  ──(cron de hora a hora)──▶  /api/sync  ──▶  Firestore
                                                              │
                                     /p/<token>  ◀── render no servidor
```

## Porque é que um não vê o do outro

- Cada pessoa tem um **token aleatório de 32 caracteres**; o link é `/p/<token>`.
- A página é renderizada **no servidor** e só carrega os lançamentos daquele `slug`.
  O HTML que chega ao browser nunca contém dados de mais ninguém — não há filtro
  no cliente a esconder nada.
- O browser **nunca fala com o Firestore**. Não há SDK de cliente, e
  `firestore.rules` nega todos os acessos diretos. Só o Admin SDK, no servidor, lê.
- Nenhuma página é posta em cache (`force-dynamic`), para não haver hipótese de
  servir o painel de alguém a outra pessoa.
- A raiz `/` e qualquer token inválido não revelam nada, nem sequer quantas
  pessoas existem.

Se um link vazar, expõe **apenas** aquela pessoa, e roda-se com
`npm run tokens -- <slug>`.

## Como a planilha é lida

O leitor procura o cabeçalho nas primeiras 15 linhas e aceita vários nomes por
coluna (ver `COLUNAS` em `lib/config.ts`):

| Campo | Cabeçalhos aceites | Obrigatório |
|---|---|---|
| Data | `Data`, `Dia`, `Quando`… | não (fica "Sem data") |
| Descrição | `Descrição`, `Item`, `Gasto`… | não |
| Valor | `Valor`, `Preço`, `Total`… | **sim** |
| Pessoa | `Pessoa`, `Quem`, `Categoria`, `Tag`… | **sim** |
| Pago | `Pago`, `Status`, `Situação`… | não (assume em aberto) |

Aguenta `R$ 1.234,56`, `1,234.56`, `(50)` para negativos, e datas em
`19/09/2026`, `2026-09-19`, `19 de setembro`, ou número de série do Sheets.

Uma linha só entra se a coluna de pessoa disser `mãe`, `Ulisses`, `Fernando` ou
`Heloísa` (ver `aliases` em `lib/config.ts`). Tudo o resto é ignorado em silêncio —
é o que permite ter a planilha cheia de outras coisas.

## Instalação

```bash
npm install
cp .env.example .env.local     # e preenche
```

**Google Sheets.** Em console.cloud.google.com: cria um projeto, ativa a
*Google Sheets API*, cria uma conta de serviço e gera uma chave JSON. Copia
`client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `private_key` →
`GOOGLE_PRIVATE_KEY` (entre aspas, com os `\n`). Depois **partilha a folha com
esse email**, em modo leitura. `PLANILHA_ID` é o pedaço do URL entre `/d/` e `/edit`.

**Firebase.** Cria o projeto, ativa o Firestore, e em *Definições do projeto →
Contas de serviço* gera uma chave privada. Preenche as três variáveis
`FIREBASE_*`. Publica as regras: `firebase deploy --only firestore:rules`.

**Segredos.** `openssl rand -hex 32` para `CRON_SECRET` e outro para `ADMIN_TOKEN`.

## Primeiro arranque

```bash
npm run tokens   # cria o token de cada pessoa e imprime os 4 links
npm run sync     # lê a planilha e enche o Firestore (mostra o que ignorou)
npm run dev
```

O `npm run sync` imprime as colunas que encontrou e avisa de cada linha que não
conseguiu ler — é por aí que se afina o `lib/config.ts`.

## Deploy

```bash
vercel
```

Mete as mesmas variáveis em *Settings → Environment Variables* e
`NEXT_PUBLIC_BASE_URL` com o domínio final. O `vercel.json` já agenda o sync de
hora a hora; a Vercel envia o `CRON_SECRET` sozinha no cabeçalho.

Para forçar um sync à mão:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/sync
```

## Onde mexer

| Quero… | Ficheiro |
|---|---|
| Acrescentar ou tirar uma pessoa | `lib/config.ts` → `PESSOAS` |
| A planilha usa outro nome de coluna | `lib/config.ts` → `COLUNAS` |
| Mudar de R$ para € | `lib/config.ts` → `MOEDA` |
| Sync mais ou menos frequente | `vercel.json` → `crons.schedule` |
| Mudar o visual | `app/globals.css` e `app/Painel.tsx` |
