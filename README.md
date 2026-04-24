# Client-Bank Import for Bitrix24

[![Bitrix24 UI](https://img.shields.io/badge/Made%20with-Bitrix24%20UI-2fc6f6?logo=bitrix24&labelColor=020420)](https://bitrix24.github.io/b24ui/)

A web application that imports bank payment statements from client-bank exports into a **Bitrix24 Universal List**. Runs as an embedded B24 Frame application directly inside the Bitrix24 interface.

---

## Table of Contents

- [What it does](#what-it-does)
- [Supported file formats](#supported-file-formats)
- [Prerequisites](#prerequisites)
- [Step 1. Install and run](#step-1-install-and-run)
- [Step 2. Prepare Bitrix24 — create the universal list](#step-2-prepare-bitrix24--create-the-universal-list)
- [Step 3. Register the app in Bitrix24](#step-3-register-the-app-in-bitrix24)
- [Step 4. Configure environment variables](#step-4-configure-environment-variables)
- [Step 5. Build and deploy](#step-5-build-and-deploy)
- [Step 6. Using the application](#step-6-using-the-application)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

---

## What it does

1. Accepts a client-bank export file (`.txt` or `.csv`)
2. Auto-detects the format and decodes the encoding (win1251 → utf-8)
3. Parses operations: splits into **incoming** and **outgoing** payments, extracts counterparty details
4. Shows a preview of all operations in the UI before importing
5. Creates elements in the **Bitrix24 Universal List** ("Payments") via REST API
6. Deduplicates on re-import — the same payment can never be imported twice

---

## Supported file formats

| Format | Signature | Status |
|--------|-----------|--------|
| **Client-bank export** | File starts with `***** ^Type=` | ✅ Fully supported |
| **1CClientBankExchange** | File starts with `1CClientBankExchange` | ⚠️ Recognized, import mapping in progress |
| **CSV** | `.csv` file with `,` `;` or `\t` delimiters | ✅ Fallback format |

### CSV file structure

Columns are read left to right (header row is optional):

```
Date | Amount | Payment description | Counterparty
```

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (`npm i -g pnpm`)
- **Bitrix24** — cloud or on-premise portal with administrator access
- A publicly accessible **HTTPS URL** for the app (e.g. a [cloudpub](https://cloudpub.ru) tunnel, ngrok, or your own server)

---

## Step 1. Install and run

```bash
# Clone the repository
git clone <repo-url> clbank-import
cd clbank-import

# Install dependencies
pnpm install

# Copy the config example
cp .env.example .env
```

Start the development server:

```bash
pnpm dev
# → http://localhost:3000
```

> **Note:** Without a Bitrix24 connection the app runs in preview mode —
> you can parse files and browse operations, but the import button will be disabled.

---

## Step 2. Prepare Bitrix24 — create the universal list

Before registering the app you need to create a **Universal List** in Bitrix24 with the required fields.

### 2.1 Create the list

1. Sign in to Bitrix24 → open **Lists** (under "Collaboration" or "Tools")
2. Click **"Create list"**
3. Set a name, e.g. `Payments`, type — `lists`
4. Note the **list ID** (visible in the URL or list settings as `IBLOCK_ID`)

### 2.2 Required list fields

Create the following **custom fields** in the list with the exact symbolic codes (`CODE` / XML_ID) shown below. The app resolves field IDs at runtime via `lists.field.get` using these codes.

> The symbolic code is set in the field settings as "Code" or "XML_ID". It must match exactly (case-insensitive).

| Field code (`CODE`) | Field type | Description |
|---|---|---|
| `STATUS` | List | Payment status |
| `STATUS_PROCESS` | List | Processing status |
| `DOC_NUM` | String | Document number |
| `DOC_DATE_TIME` | String / Date | Document date and time |
| `CATEGORY` | List | Direction: Incoming / Outgoing |
| `METHOD` | List | Payment method |
| `TYPE` | List | Payment type |
| `SUM` | Money | Operation amount |
| `BASE_SUM` | Number | Amount in base currency (BYN) |
| `COMMENT` | String | Comment |
| `MY_COMPANY_LST_RQ` | Element link | My company (requisites) |
| `MY_COMPANY_BANK_ACCNUM` | String | Company bank account number |
| `CLIENT_BANK_ACCNUM` | String | Counterparty bank account number |
| `ARTICLE` | Element link | Income / expense article |
| `SYS_INFO` | String | System import marker |

### 2.3 List field values

For each list-type field create the following **values** with the exact labels shown — the app matches them by display text:

**`STATUS` — Payment status:**
- `Оплачено` *(Paid)*
- `Не оплачено` *(Not paid)*
- `Отменено` *(Cancelled)*
- `Возврат` *(Refund)*
- `Помечено на удаление` *(Marked for deletion)*

**`STATUS_PROCESS` — Processing status:**
- `Черновик` *(Draft)*
- `Обработка` *(Processing)*
- `Успех` *(Success)*
- `Брак` *(Failure)*

**`CATEGORY` — Direction:**
- `Приход` *(Incoming)*
- `Расход` *(Outgoing)*

**`METHOD` — Payment method:**
- `Наличные` *(Cash)*
- `Эквайринг` *(Acquiring)*
- `Интернет эквайринг` *(Internet acquiring)*
- `Безнал` *(Cashless)*
- `Внутренний счет (Бонусы)` *(Internal account / Bonuses)*
- `~ не определено ~` *(~ not defined ~)*

**`TYPE` — Payment type:**
- `Полная оплата` *(Full payment)*
- `Частичная оплата` *(Partial payment)*

> The values listed above are stored in Russian in Bitrix24 because the list configuration
> is managed on a Russian-language portal. The app matches them by their exact display labels.

### 2.4 Create "My company" and "Articles" reference items

Every imported payment is linked to:
- **My company** (`MY_COMPANY_LST_RQ`) — an element from a reference list that holds your organization's bank requisites
- **Article** (`ARTICLE`) — an income or expense article element

Create these elements in the corresponding reference lists and note their **numeric IDs** — they are needed in `.env`.

---

## Step 3. Register the app in Bitrix24

### 3.1 Required scopes

When registering the app, enable the following permissions:

| Scope | Purpose |
|---|---|
| `user_brief` | Basic profile data of the current user |
| `lists` | Read and write universal lists |
| `tasks` | Additional SDK permissions |
| `entity` | Work with custom entities |

### 3.2 Local application (for development)

1. In Bitrix24 go to: **Settings** → **Applications** → **Add Application**
2. Select **"Local Application"**
3. Fill in the fields:

| Parameter | Value |
|---|---|
| **Application URL** | `https://your-domain.example.com` |
| **Permissions** | Check all scopes from the table above |

4. Click **Save**
5. Bitrix24 will open the app in an iframe — it appears in the side panel

> For local development use an HTTPS tunnel, e.g. [cloudpub.ru](https://cloudpub.ru).
> When using cloudpub, add its domain to `NUXT_ALLOWED_HOSTS` in `.env`.

---

## Step 4. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```dotenv
# --- Application URL ---
# Public HTTPS URL where the app is hosted
NUXT_PUBLIC_SITE_URL=https://your-domain.example.com

# Base path (leave / if the app is at the root)
NUXT_APP_BASE_URL=/

# --- Security ---
# Comma-separated list of allowed hosts for the Vite dev server
NUXT_ALLOWED_HOSTS=.cloudpub.ru

# --- Bitrix24 universal list settings ---

# Iblock type (usually "lists" — do not change)
NUXT_PUBLIC_B24_IBLOCK_TYPE_ID=lists

# ID of the "Payments" list (from the URL or list settings in B24)
NUXT_PUBLIC_B24_IBLOCK_ID=31

# Element ID of the "My company" record in the requisites reference list
NUXT_PUBLIC_B24_MY_COMPANY_ID=10216

# Element ID of the "Article" for incoming operations
NUXT_PUBLIC_B24_ARTICLE_ID_IN=10214

# Element ID of the "Article" for outgoing operations
NUXT_PUBLIC_B24_ARTICLE_ID_OUT=10215
```

### Where to find the IDs

**List ID (`IBLOCK_ID`):**
- Open the list in Bitrix24
- Check the URL: `...lists/index.php?ID=**31**` — the number after `ID=`
- Or open list settings → field "ID"

**"My company" element ID (`MY_COMPANY_ID`):**
- Open the reference list that contains your company record
- Click on the element
- The URL contains the ID: `...element/**10216**/`

**Article IDs (`ARTICLE_ID_IN` / `ARTICLE_ID_OUT`):**
- Same approach — open the income/expense articles list
- Note the ID for the incoming article and the outgoing article separately

---

## Step 5. Build and deploy

### Production build

```bash
pnpm build
```

Build artifacts are placed in `.output/`.

### Preview the build locally

```bash
pnpm preview
```

### Deploy

The app is a standard Nuxt/Nitro application. Deployment options:

- **Node.js server:** run `.output/server/index.mjs`
- **Static (SSG):** `pnpm generate` → upload `.output/public/` to any static host
- **Docker / PM2:** standard Nuxt approach

See the [Nuxt deployment docs](https://nuxt.com/docs/getting-started/deployment) for more details.

> The app **must** be served over **HTTPS** — Bitrix24 does not load HTTP iframes.

---

## Step 6. Using the application

Once the app is set up and registered in Bitrix24, the UI shows four sections that appear sequentially.

### 6.1 Upload a file

1. Open the app inside Bitrix24 (side panel or embedded iframe)
2. Click **"Select file"**
3. Choose a client-bank export file (`.txt`) or a CSV file
4. The file is processed automatically:
   - Format is detected (client-bank / 1C / CSV)
   - Encoding is decoded (win1251 → utf-8)
   - Operations are parsed

### 6.2 Review account information

After successful parsing, a card appears showing:
- Account name
- Bank account number and currency
- Bank name
- Document title

### 6.3 Review operations

Operations are split into two sections:
- **Incoming** (green) — credit payments with total amount
- **Outgoing** (red) — debit payments with total amount

Each operation shows:
- Counterparty name
- Counterparty UNP / tax ID
- Counterparty account number
- Amount and date
- Payment description

### 6.4 Import into Bitrix24

1. Make sure there is no "Bitrix24 not connected" warning at the top
2. Click **"Import operations"**
3. The app processes each operation sequentially:
   - Generates a unique hash (MD5 of: account + document number + date + amount + currency)
   - Checks for an existing record (`lists.element.get`)
   - Creates a list element if not found (`lists.element.add`)
4. On completion, a counter of successfully imported operations is shown along with any errors

### 6.5 Reset

Click **"Reset"** in the top-right corner to clear all data and start over with a new file.

---

## Architecture

```
File (.txt / .csv)
        │
        ▼
┌──────────────────────────────────┐
│         decodeFile()             │  win1251 → utf-8 (iconv-lite), stripBom()
└──────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Format detection                            │
│  startsWith("***** ^Type=")       → ParserTxtFile                │
│                                     → processMapping()           │
│                                     → toast (✅ or ⚠️ no ops)   │
│  startsWith("1CClientBankExch.")  → Parser (⚠️ no mapping yet)  │
│  otherwise                        → parseBankCsv()               │
│                                     → convertCSVToOperations()   │
│                                     → toast (✅ / ⚠️ / ❌)      │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│       CompanyStatement           │
│  title, accNumber, currency      │
│  in: BankOperation[]             │
│  out: BankOperation[]            │
└──────────────────────────────────┘
        │  importToBitrix24()
        ▼
┌──────────────────────────────────┐
│     useB24ListSchema.load()      │  lists.field.get → field code cache
└──────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│  for each operation:             │
│  MD5(account+num+date+sum+curr)  │ → lists.element.get  (duplicate check)
│  if not found →                  │ → lists.element.add  (create)
└──────────────────────────────────┘
```

### Key composables

| Composable | Purpose |
|---|---|
| `useClBankImportPage` | Main logic: parsing, mapping, import, UI state |
| `useParser` — `Parser` | Parser for the 1CClientBankExchange format |
| `useParser` — `ParserTxtFile` | Parser for the client-bank format (`***** ^Type=`) |
| `useB24` | B24Frame SDK initialization and instance access |
| `useB24ListConfig` | Reads list configuration from `runtimeConfig` (`.env`) |
| `useB24ListSchema` | Loads and caches list field schema via `lists.field.get` |
| `useBankStatementPresentation` | Formats amounts and account numbers for display |

### Utilities

| Module | Functions | Purpose |
|--------|-----------|---------|
| `utils/index` | `parseAmount`, `parseIntSafe` | Parsing numbers from raw bank strings |
| `utils/index` | `stripBom` | Removes UTF-8 BOM character from file content |
| `utils/index` | `hasRecords` | Checks that an object has at least one key |
| `utils/csv` | `parseBankCsv` | Detects and parses CSV bank statements |
| `utils/csv` | `looksLikeBankDate`, `looksLikeAmountCell` | Heuristic validators for CSV columns |
| `utils/csv` | `isProbablyCsvHeaderRow` | Detects header rows to skip during parsing |

### Supported currencies

| Code | Numeric | Default |
|------|---------|---------|
| BYN | 933 | ✅ |
| RUB | 643 | |
| USD | 840 | |
| EUR | 978 | |
| CNY | 156 | |

---

## Troubleshooting

### "Bitrix24 not connected" on startup

- Make sure you are opening the app **inside Bitrix24** (via the side panel or the Applications page), not directly in a browser tab
- Verify that the Application URL in B24 settings matches the actual deployed URL
- Ensure the app is served over HTTPS

### "Missing fields/values in Bitrix24 list: ..."

- Check that all fields from the [table above](#22-required-list-fields) exist in the list with the exact symbolic codes
- Check that the list field values match **the exact text labels** specified in [section 2.3](#23-list-field-values)
- Open the browser console — `console.log('result', result)` prints the raw `lists.field.get` response for debugging

### "Blocked request. This host is not allowed" (Vite dev server)

Add the tunnel domain to `.env`:

```dotenv
NUXT_ALLOWED_HOSTS=.your-tunnel.example.com
```

### "This record was already imported"

This is not an error — it is duplicate protection. A record with the same account, document number, date, amount, and currency already exists in the list. To re-import, delete the corresponding element in Bitrix24 manually.

### 1C format not supported

Files starting with `1CClientBankExchange` are detected but operation mapping is not yet implemented. Use the client-bank export format (`***** ^Type=`) or CSV instead.

---

## Development

```bash
# Start dev server
pnpm dev

# Lint
pnpm lint

# Build
pnpm build

# Preview production build
pnpm preview
```

### Tech stack

- [Nuxt 4](https://nuxt.com/) + Vue 3
- [@bitrix24/b24ui-nuxt](https://bitrix24.github.io/b24ui/) — UI components
- [@bitrix24/b24jssdk](https://bitrix24.github.io/b24jssdk/) — Bitrix24 JS SDK (B24Frame)
- [iconv-lite](https://github.com/ashtuchkin/iconv-lite) — win1251 decoding
- [crypto-js](https://github.com/brix/crypto-js) — MD5 for deduplication
- [Tailwind CSS](https://tailwindcss.com/)

### Useful links  

- [Bitrix24 REST API — lists.element.add](https://training.bitrix24.com/rest_help/lists/element/lists_element_add.php)
- [Bitrix24 REST API — lists.field.get](https://training.bitrix24.com/rest_help/lists/fields/lists_field_get.php)
- [B24 JS SDK — B24Frame](https://bitrix24.github.io/b24jssdk/docs/frame/)
- [Nuxt deployment documentation](https://nuxt.com/docs/getting-started/deployment)
