/**
 * lib/finance/categorize.ts
 *
 * Auto-categorization with a clear precedence chain:
 *   1. User manual override (categoryLocked = true) — never touched here
 *   2. Exact merchant alias match
 *   3. Category keyword/regex rules (sorted by priority desc)
 *   4. Fallback: "Uncategorized"
 *
 * categorizeTransaction() is pure — it takes data and returns a category ID.
 * Side effects (DB writes) happen in the API layer.
 */

// ---------------------------------------------------------------------------
// Types for categorization context
// ---------------------------------------------------------------------------

export interface CategoryRuleRecord {
  id: string;
  categoryId: string;
  pattern: string;
  isRegex: boolean;
  priority: number;
}

export interface MerchantAliasRecord {
  rawPattern: string;
  cleanName: string;
  categoryHint?: string | null;
  isRegex: boolean;
}

export interface CategoryRecord {
  id: string;
  name: string;
}

export interface CategorizationInput {
  cleanDescription: string;
  merchantName?: string;
  transactionType: string;
  /** Pre-loaded rules sorted by priority desc */
  rules: CategoryRuleRecord[];
  /** Pre-loaded merchant aliases */
  aliases: MerchantAliasRecord[];
  /** All categories by name */
  categoryByName: Map<string, CategoryRecord>;
  /** Fallback category ID for "Uncategorized" */
  uncategorizedId: string;
}

export interface CategorizationResult {
  categoryId: string;
  method: "merchant_alias" | "keyword_rule" | "fallback";
  confidence: "high" | "medium" | "low";
}

// ---------------------------------------------------------------------------
// Main categorization function
// ---------------------------------------------------------------------------

/**
 * Determines the best category for a transaction based on rules and aliases.
 *
 * Note: manual overrides (categoryLocked) are checked BEFORE calling this
 * function — if locked, skip entirely.
 */
export function categorizeTransaction(input: CategorizationInput): CategorizationResult {
  const { cleanDescription, merchantName, aliases, rules, categoryByName, uncategorizedId } = input;

  const searchText = [merchantName ?? "", cleanDescription].join(" ").toLowerCase();

  // Step 1: Merchant alias exact match
  for (const alias of aliases) {
    if (alias.categoryHint) {
      let matched = false;
      if (alias.isRegex) {
        try {
          matched = new RegExp(alias.rawPattern, "i").test(searchText);
        } catch { /* ignore bad regex */ }
      } else {
        matched = searchText.includes(alias.rawPattern.toLowerCase());
      }

      if (matched) {
        const cat = categoryByName.get(alias.categoryHint.toLowerCase());
        if (cat) {
          return { categoryId: cat.id, method: "merchant_alias", confidence: "high" };
        }
      }
    }
  }

  // Step 2: Keyword/category rules (already sorted by priority desc)
  for (const rule of rules) {
    let matched = false;
    if (rule.isRegex) {
      try {
        matched = new RegExp(rule.pattern, "i").test(searchText);
      } catch { /* ignore bad regex */ }
    } else {
      matched = searchText.includes(rule.pattern.toLowerCase());
    }

    if (matched) {
      return { categoryId: rule.categoryId, method: "keyword_rule", confidence: "medium" };
    }
  }

  // Step 3: Fallback
  return { categoryId: uncategorizedId, method: "fallback", confidence: "low" };
}

// ---------------------------------------------------------------------------
// Seed category rules
// Used to populate DB on first run via a seed script.
// ---------------------------------------------------------------------------

export interface SeedRule {
  pattern: string;
  isRegex: boolean;
  priority: number;
  categoryName: string;
}

export const SEED_CATEGORY_RULES: SeedRule[] = [
  // Groceries
  { pattern: "woolworths|checkers|pick n pay|shoprite|spar|game|makro", isRegex: true, priority: 10, categoryName: "Groceries" },
  // Restaurants & Takeaway
  { pattern: "mcdonald|kfc|steers|nandos|wimpy|debonairs|pizza|burger|spur|ocean basket|kung food|mr d|uber eat|takealot food", isRegex: true, priority: 10, categoryName: "Restaurants & Takeaway" },
  // Transport
  { pattern: "uber|bolt|lyft|taxi|gautrain|metrobus|myciti|e-tag|sanral|tolls", isRegex: true, priority: 10, categoryName: "Transport" },
  // Fuel
  { pattern: "engen|bp|shell|sasol|total energy|chevron|caltex|fuel|petrol", isRegex: true, priority: 10, categoryName: "Fuel" },
  // Utilities
  { pattern: "city of cape town|city of johannesburg|eskom|prepaid electricity|municipal|water|sewage|rates", isRegex: true, priority: 9, categoryName: "Utilities" },
  // Subscriptions
  { pattern: "netflix|dstv|showmax|spotify|apple|microsoft|google one|dropbox|adobe|github", isRegex: true, priority: 9, categoryName: "Subscriptions" },
  // Medical
  { pattern: "pharmacy|clicks|dis-chem|medirite|hospital|doctor|dentist|optometrist|medical aid|discovery health|bonitas|momentum", isRegex: true, priority: 9, categoryName: "Medical & Health" },
  // Bank Fees
  { pattern: "bank charge|service fee|monthly fee|administration fee|maintenance fee", isRegex: true, priority: 8, categoryName: "Bank Fees" },
  // ATM / Cash
  { pattern: "atm|cash withdrawal|withdraw", isRegex: true, priority: 8, categoryName: "Cash & ATM" },
  // Income / Salary
  { pattern: "salary|payroll|remuneration|wage", isRegex: true, priority: 10, categoryName: "Salary" },
  // Interest
  { pattern: "interest received|interest credit", isRegex: true, priority: 9, categoryName: "Interest Income" },
  // Insurance
  { pattern: "outsurance|santam|discovery insur|old mutual|sanlam|hollard|fnb insur|standard insur", isRegex: true, priority: 9, categoryName: "Insurance" },
  // Shopping
  { pattern: "h&m|zara|mr price|ackermans|pep stores|edgars|woolworths fashion|cotton on|superbalist", isRegex: true, priority: 7, categoryName: "Clothing & Shopping" },
  // Entertainment
  { pattern: "cinema|nu metro|ster kinekor|event|concert|theatre|sport", isRegex: true, priority: 7, categoryName: "Entertainment" },
  // Education
  { pattern: "university|school fees|tuition|education|varsity|college", isRegex: true, priority: 8, categoryName: "Education" },
];

export const SEED_CATEGORIES: { name: string; color: string; icon: string; isSystem: boolean }[] = [
  { name: "Groceries",              color: "#22c55e", icon: "ShoppingCart",  isSystem: true },
  { name: "Restaurants & Takeaway", color: "#f97316", icon: "Utensils",      isSystem: true },
  { name: "Transport",              color: "#3b82f6", icon: "Car",           isSystem: true },
  { name: "Fuel",                   color: "#eab308", icon: "Fuel",          isSystem: true },
  { name: "Utilities",              color: "#06b6d4", icon: "Zap",           isSystem: true },
  { name: "Subscriptions",          color: "#8b5cf6", icon: "RefreshCw",     isSystem: true },
  { name: "Medical & Health",       color: "#ec4899", icon: "Heart",         isSystem: true },
  { name: "Bank Fees",              color: "#6b7280", icon: "Landmark",      isSystem: true },
  { name: "Cash & ATM",             color: "#78716c", icon: "Banknote",      isSystem: true },
  { name: "Salary",                 color: "#10b981", icon: "TrendingUp",    isSystem: true },
  { name: "Interest Income",        color: "#14b8a6", icon: "Percent",       isSystem: true },
  { name: "Insurance",              color: "#6366f1", icon: "Shield",        isSystem: true },
  { name: "Clothing & Shopping",    color: "#f43f5e", icon: "Tag",           isSystem: true },
  { name: "Entertainment",          color: "#a855f7", icon: "Film",          isSystem: true },
  { name: "Education",              color: "#0ea5e9", icon: "BookOpen",      isSystem: true },
  { name: "Transfers",              color: "#94a3b8", icon: "ArrowLeftRight", isSystem: true },
  { name: "Investments",            color: "#16a34a", icon: "TrendingUp",    isSystem: true },
  { name: "Uncategorized",          color: "#d1d5db", icon: "HelpCircle",    isSystem: true },
];
