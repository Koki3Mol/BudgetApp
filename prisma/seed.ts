/**
 * prisma/seed.ts
 *
 * Seeds the database with:
 * - Default user (single-user MVP)
 * - System categories (18 SA-specific categories)
 * - Category rules (regex-based auto-categorization)
 *
 * Run with: npm run db:seed
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { PrismaClient } from "../generated/prisma/client";
import { SEED_CATEGORIES, SEED_CATEGORY_RULES } from "../lib/finance/categorize";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const rawUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const dbPath = rawUrl.replace(/^file:/, "");
const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
const adapter = new PrismaBetterSqlite3({ url: absolutePath });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Default user
  const user = await prisma.user.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", name: "Default User", email: "user@budget.local" },
  });
  console.log(`✅ User: ${user.id}`);

  // 2. System categories — upsert by name
  const createdCats: Record<string, string> = {}; // name -> id
  for (const cat of SEED_CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { name: cat.name, userId: "default" } });
    if (existing) {
      createdCats[cat.name] = existing.id;
    } else {
      const created = await prisma.category.create({
        data: {
          userId: "default",
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          isSystem: cat.isSystem,
        },
      });
      createdCats[cat.name] = created.id;
    }
  }
  console.log(`✅ ${SEED_CATEGORIES.length} categories seeded`);

  // 3. Category rules — use categoryName to resolve categoryId
  let ruleCount = 0;
  for (const rule of SEED_CATEGORY_RULES) {
    const categoryId = createdCats[rule.categoryName];
    if (!categoryId) {
      console.warn(`⚠ No category found for rule: ${rule.categoryName}`);
      continue;
    }
    const existing = await prisma.categoryRule.findFirst({
      where: { categoryId, pattern: rule.pattern },
    });
    if (!existing) {
      await prisma.categoryRule.create({
        data: {
          categoryId,
          pattern: rule.pattern,
          isRegex: rule.isRegex,
          priority: rule.priority,
        },
      });
      ruleCount++;
    }
  }
  console.log(`✅ ${ruleCount} category rules seeded`);

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
