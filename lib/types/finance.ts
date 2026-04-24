/**
 * lib/types/finance.ts
 *
 * Central TypeScript domain models for the finance dashboard.
 * These are application-layer types, separate from Prisma's generated types,
 * so they can evolve independently and be used in both client and server code.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type Currency = "ZAR" | "USD" | "EUR" | "GBP" | "BTC" | "ETH" | string;

export type TransactionDirection = "DEBIT" | "CREDIT";

export type TransactionType =
  | "EXPENSE"
  | "INCOME"
  | "TRANSFER"
  | "REFUND"
  | "FEE"
  | "CARD_PURCHASE"
  | "EFT"
  | "DEBIT_ORDER"
  | "CASH_WITHDRAWAL"
  | "INVESTMENT"
  | "UNKNOWN";

export type AssetType =
  | "STOCK"
  | "CRYPTO"
  | "ETF"
  | "BOND"
  | "CASH"
  | "PROPERTY"
  | "OTHER";

export type InvestmentTransactionType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "FEE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "SPLIT";

// ---------------------------------------------------------------------------
// Normalized Transaction Payload
// This is what every parser must produce after normalization.
// ---------------------------------------------------------------------------

export interface NormalizedTransaction {
  /** ISO 8601 date string, time set to midnight UTC */
  date: string;
  /** Positive monetary amount regardless of direction */
  amount: number;
  currency: Currency;
  direction: TransactionDirection;
  type: TransactionType;
  rawDescription: string;
  cleanDescription: string;
  merchantName?: string;
  referenceNumber?: string;
  /** Running balance from statement, if available */
  balance?: number;
  /** Deterministic hash for deduplication */
  dedupeHash: string;
}

// ---------------------------------------------------------------------------
// Transaction (full DB record shape, returned from API)
// ---------------------------------------------------------------------------

export interface Transaction extends NormalizedTransaction {
  id: string;
  userId: string;
  accountId: string;
  batchId?: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  categoryLocked: boolean;
  notes?: string;
  tags: string[];
  isDuplicate: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  parentId?: string;
  isSystem: boolean;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export interface Budget {
  id: string;
  name: string;
  year?: number;
  month?: number; // 1–12
  currency: Currency;
  isActive: boolean;
  items: BudgetItem[];
}

export interface BudgetItem {
  id: string;
  budgetId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
  actual?: number; // computed from transactions
  notes?: string;
}

export interface BudgetSuggestion {
  categoryId: string;
  categoryName: string;
  suggestedAmount: number;
  /** Method used: "trimmed_mean" | "median" */
  method: "trimmed_mean" | "median";
  /** Number of monthly samples used */
  sampleCount: number;
  historicalAvg: number;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportSource =
  | "SA_BANK_PDF"
  | "SA_BANK_CSV"
  | "GOOGLE_PAY_CSV"
  | "GENERIC_CSV"
  | "INVESTMENT_CSV"
  | "MANUAL";

export type ImportStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "PARTIAL";

export interface ImportBatch {
  id: string;
  source: ImportSource;
  status: ImportStatus;
  originalFilename: string;
  parsedCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  statementFrom?: string;
  statementTo?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ImportError {
  rowIndex?: number;
  severity: "warning" | "error";
  code: string;
  message: string;
  rawData?: Record<string, unknown>;
}

// Shape returned by the parse-preview API before the user commits
export interface ImportPreview {
  source: ImportSource;
  filename: string;
  fileHash: string;
  statementFrom?: string;
  statementTo?: string;
  accountHint?: string;
  transactions: NormalizedTransaction[];
  errors: ImportError[];
  duplicates: DuplicateCandidate[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}

export interface DuplicateCandidate {
  incomingIndex: number;
  /** Existing transaction ID in DB, if matched */
  existingId?: string;
  /** Another index in this batch if within-batch duplicate */
  batchIndex?: number;
  reason: "exact_hash" | "fuzzy_match" | "within_batch";
}

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: Currency;
  exchange?: string;
  isin?: string;
}

export interface Holding {
  id: string;
  assetId: string;
  asset: Asset;
  quantity: number;
  averageCost: number;
  totalCost: number;
  currency: Currency;
  latestPrice?: number;
  currentValue?: number;
  unrealizedGain?: number;
  unrealizedGainPct?: number;
}

export interface PortfolioSummary {
  totalCost: number;
  totalValue: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
  currency: Currency;
  allocations: AllocationSlice[];
  holdings: Holding[];
}

export interface AllocationSlice {
  assetType: AssetType;
  value: number;
  pct: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  period: { from: string; to: string };
  currency: Currency;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  topCategories: CategorySpend[];
  monthlyTrend: MonthlyTrendPoint[];
  recentTransactions: Transaction[];
  budgetSnapshot: BudgetSnapshot[];
  importHealth: ImportHealth;
  netWorthSnapshot: NetWorthSnapshot;
}

export interface CategorySpend {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
  pct: number;
  transactionCount: number;
}

export interface MonthlyTrendPoint {
  /** e.g. "2025-03" */
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface BudgetSnapshot {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  budgeted: number;
  actual: number;
  pct: number;
  isOverBudget: boolean;
}

export interface ImportHealth {
  totalBatches: number;
  lastImportDate?: string;
  uncategorizedCount: number;
  duplicatesDetected: number;
  recentErrors: number;
}

export interface NetWorthSnapshot {
  totalAssets: number;
  totalLiabilities: number; // future: liabilities model
  netWorth: number;
  currency: Currency;
  portfolioValue: number;
}

// ---------------------------------------------------------------------------
// API Response Wrappers
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
