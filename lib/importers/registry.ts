/**
 * lib/importers/registry.ts
 *
 * Central registry of all available parsers.
 * Supports auto-detection: given a file, iterate parsers until one claims it.
 * Supports explicit selection: caller requests a specific source type.
 */

import type { StatementParser } from "./types";
import type { ImportSource } from "@/lib/types/finance";
import { GooglePayCsvParser } from "./googlePayCsvParser";
import { ExampleSaBankCsvParser } from "./exampleSaBankCsvParser";
import { ExampleSaBankPdfParser } from "./exampleSaBankPdfParser";
import { GenericCsvParser } from "./genericCsvParser";

// ---------------------------------------------------------------------------
// Registered parsers in priority order.
// More specific parsers (e.g. FNB CSV) should come before generic ones.
// ---------------------------------------------------------------------------

const parsers: StatementParser[] = [
  new ExampleSaBankCsvParser(),
  new ExampleSaBankPdfParser(),
  new GooglePayCsvParser(),
  new GenericCsvParser(), // fallback — always last
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all registered parsers.
 */
export function getAllParsers(): StatementParser[] {
  return parsers;
}

/**
 * Find a parser by its source type identifier.
 */
export function getParserBySource(source: ImportSource): StatementParser | undefined {
  return parsers.find((p) => p.source === source);
}

/**
 * Auto-detect which parser should handle a file.
 * Returns the first parser that claims the file via canHandle().
 * Falls back to GenericCsvParser if nothing matches.
 */
export async function detectParser(
  filename: string,
  buffer: Buffer
): Promise<StatementParser | undefined> {
  for (const parser of parsers) {
    try {
      if (await parser.canHandle(filename, buffer)) {
        return parser;
      }
    } catch {
      // Ignore detection errors; try next parser
    }
  }
  return undefined;
}

/**
 * Resolve a parser: use explicit source if provided, otherwise auto-detect.
 */
export async function resolveParser(
  filename: string,
  buffer: Buffer,
  explicitSource?: ImportSource
): Promise<StatementParser | undefined> {
  if (explicitSource) {
    return getParserBySource(explicitSource);
  }
  return detectParser(filename, buffer);
}
