# BudgetApp

A personal finance dashboard for tracking transactions, managing budgets, and monitoring investments — built for local use with a full offline-first SQLite setup.

## Features

- **Dashboard** — overview of income, expenses, and recent activity
- **Transactions** — import bank statements (PDF/CSV), view and categorise transactions with inline editing and category memory
- **Budgets** — monthly budget planner with editable income/expense group tables, Money In/Out/Remaining summary, and inline pie + bar charts
- **Investments** — track investment holdings and performance
- **Imports** — import history with per-batch and bulk delete
- **Settings** — app configuration and category management

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, Turbopack) |
| Language | TypeScript |
| Database | SQLite via Prisma 7 + `better-sqlite3` |
| Styling | Tailwind CSS v3 |
| UI Components | Radix UI primitives |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Seed with sample data
npm run db:seed

# Start dev server
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

## Database

SQLite database file is stored at `dev.db` in the project root (excluded from git). The schema is defined in `prisma/schema.prisma`.

Useful database commands:

```bash
npm run db:studio      # Open Prisma Studio (visual DB browser)
npm run db:migrate     # Run migrations
npm run db:push        # Push schema changes without migration
```

## Project Structure

```
app/
├── (app)/             # App shell (sidebar layout)
│   ├── dashboard/
│   ├── transactions/
│   ├── budgets/
│   ├── investments/
│   ├── imports/
│   └── settings/
├── api/               # API routes
│   ├── transactions/
│   ├── categories/
│   ├── budgets/
│   └── imports/
components/
├── budgets/
├── imports/
├── transactions/
└── ui/
lib/
├── db.ts              # Prisma singleton
├── importers/         # Bank statement parsers
└── utils/
prisma/
├── schema.prisma
└── seed.ts
```

## Environment Variables

Create a `.env` file at the project root (not committed to git):

```env
DATABASE_URL="file:./dev.db"
```
