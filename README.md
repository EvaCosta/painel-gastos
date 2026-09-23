# Painel de gastos

Cinco painéis privados — um por pessoa — alimentados pela folha
**Organização Mensal** do Google Sheets. Cada pessoa abre o seu link e vê **só o
que ela deve**, separado por mês. Ninguém vê o total de outro.

```
Google Sheets  ──(cron de hora a hora)──▶  /api/sync  ──▶  Firestore
                                                              │
                                     /p/<token>  ◀── render no servidor
```

## Porque é que um não vê o do outro

- Cada pessoa tem um **token aleatório de 32 caracteres**; o link é `/p/<token>`.
- A página é renderizada **no servidor** e só carrega os lançamentos daquele
  `slug`. O HTML que chega ao browser nunca contém dados de mais ninguém — não
  há filtro no cliente a esconder nada.
- O browser **nunca fala com o Firestore**. Não há SDK de cliente, e
  `firestore.rules` nega todos os acessos diretos. Só o Admin SDK, no servidor, lê.
- Nenhuma página é posta em cache (`force-dynamic`).
- A raiz `/` e qualquer token inválido não revelam nada, nem sequer quantas
  pessoas existem.

Se um link vazar, expõe **apenas** aquela pessoa, e roda-se com
`npm run tokens -- <slug>`.

## Como a planilha é lida

A folha tem uma aba por mês (`Setembro`, `Outubro`, `Novembro`, …). Dentro de
cada aba há uma secção que começa neste cabeçalho:

```
Categoria | Parcelas | Compra | Valor | Situação | Cartao | … | Nome | Total
```

**O bloco de cada pessoa é uma célula FUNDIDA na coluna `Nome`** que abrange
todas as linhas dela — `K136:K160 = "Mae"`, por exemplo. Ao lado, na coluna
`Total`, a folha guarda a sua própria soma do bloco.

Por isso o leitor usa `spreadsheets.get` com `includeGridData`: o endpoint
`values` devolve só texto, e aqui a estrutura vive nas fusões.

### Regras que vieram da planilha real

| Regra | Porquê |
|---|---|
| O bloco é a fusão, não a cor | Verificado em 15 blocos de 15: o total da coluna `Total` cobre exactamente as linhas da fusão. Há blocos pintados para lá dela. |
| `Mercado` e `VIAGEM JF` não são pessoas | `Mercado` é o cartão da mãe — usá-lo não quer dizer que ela esteja a dever. Ver `ROTULOS_IGNORADOS`. |
| Saldo = soma simples da coluna `Valor` | Linhas negativas são pagamentos já feitos pela pessoa (`"que ela ja pagou  -200,00"`). |
| `pago` na coluna `Situação` salda a linha | O dono da planilha só a marca quando a pessoa acerta mesmo. A linha continua à vista, riscada, mas sai do total. Ver `MARCAS_DE_PAGO`. |
| "dinheiro está comigo" também salda | A fatura do cartão ainda não foi paga, mas quem devia já entregou o dinheiro. Ver `FRASES_DE_PAGO`. |
| O cartão não vai para o painel | Em que cartão a compra foi feita é assunto de quem pagou, não de quem deve. |
| O mês vem da **aba** | A coluna `Parcelas` não são datas: `02/03` é parcela 2 de 3, e também lá aparecem `3 ml`, `shopee 2`, `pg`. |
| Lê a aba da próxima fatura a vencer | As abas são faturas, não meses de calendário. Até ao dia 15 conta a deste mês; depois, a do mês seguinte — a 23 de Setembro o que interessa é Outubro. |

### Valores escritos como texto

A fórmula da folha soma **só células numéricas**. Um valor escrito como
`R$ 61,18` ou `380,5*` fica guardado como texto e **desaparece do total dela**
em silêncio — nas três abas actuais são R$ 798,57 que a folha não conta.

O leitor lê os dois formatos e conta tudo. Quando o seu total difere do
declarado na coluna `Total`, o sync emite um aviso a dizer quanto e porquê, em
vez de escolher um em silêncio.

## Instalação

```bash
npm install
cp .env.example .env.local     # e preenche
```

**Firebase.** Cria o projeto, activa o Firestore (edição *Standard*, região
`southamerica-east1`), e em *Configurações do projeto → Contas de serviço* gera
uma chave privada. Do JSON saem `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e
`FIREBASE_PRIVATE_KEY`. Publica as regras:
`npx firebase-tools deploy --only firestore:rules`.

**Google Sheets.** O projeto Firebase **é** um projeto Google Cloud: dá para usar
a mesma conta de serviço. Em console.cloud.google.com, no mesmo projeto, activa
a *Google Sheets API*; depois **partilha a folha** (leitura) com o
`client_email`. `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_PRIVATE_KEY` são os
mesmos valores do Firebase.

> A `private_key` traz `\n` literais. No `.env.local` mete-a entre aspas tal como
> vem do JSON; na Vercel cola-a com as quebras de linha reais. O código aguenta
> os dois casos.

**Segredos.** `openssl rand -hex 32` para `CRON_SECRET` e outro para `ADMIN_TOKEN`.

## Primeiro arranque

```bash
npm run tokens          # cria o token de cada pessoa e imprime os 5 links
npm run sync -- --seco  # lê a planilha e mostra o que saiu, SEM gravar
npm run sync            # grava no Firestore
npm run dev
```

O `--seco` imprime os blocos que encontrou, as linhas de cada um e os avisos.
É por aí que se confere antes de pôr o que quer que seja à frente de alguém.

## Deploy

```bash
vercel
```

Mete as mesmas variáveis em *Settings → Environment Variables* e
`NEXT_PUBLIC_BASE_URL` com o domínio final. A Vercel envia o `CRON_SECRET`
sozinha no cabeçalho.

O `vercel.json` agenda o sync **uma vez por dia**, às 9h UTC (6h em Brasília) —
é o que o plano Hobby permite. Num plano pago dá para pôr de hora a hora
(`"schedule": "0 * * * *"`).

Forçar um sync à mão, entre agendamentos:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/sync
```

`/admin/<ADMIN_TOKEN>` dá a visão geral de toda a gente, e os links para enviar.

## Onde mexer

| Quero… | Ficheiro |
|---|---|
| Acrescentar ou tirar uma pessoa | `lib/config.ts` → `PESSOAS` |
| Ver outros meses | `.env` → `PLANILHA_ABAS=Setembro,Outubro` (vazio = automático) |
| Mudar o dia de vencimento | `.env` → `DIA_VENCIMENTO` |
| Um rótulo novo que não é pessoa | `lib/config.ts` → `ROTULOS_IGNORADOS` |
| Mudar de R$ para € | `lib/config.ts` → `MOEDA` |
| Sync mais ou menos frequente | `vercel.json` → `crons.schedule` |
| Mudar o visual | `app/globals.css` e `app/Painel.tsx` |

## Testes

```bash
npm test
```

11 testes sobre o leitor, incluindo os casos reais que deram problema: o bloco
da Mãe de Novembro (a folha mostra R$ 20,52, as linhas somam R$ 171,23), a linha
negativa da Vó, o cartão da mãe a ficar de fora, e cada pessoa a receber só o
seu bloco.
