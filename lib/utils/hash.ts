/**
 * lib/utils/hash.ts
 * Cryptographic utilities. Node.js crypto only — server-side.
 */

import { createHash } from "crypto";

/** SHA-256 of a buffer — used for file dedup */
export function computeFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** SHA-256 of a UTF-8 string */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
