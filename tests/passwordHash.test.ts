import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { readPasswordHash } from "../src/lib/passwordHash";

const hash = bcrypt.hashSync("correct horse battery", 4);

describe("readPasswordHash", () => {
  it("accepts a clean bcrypt hash", () => {
    expect(readPasswordHash(hash)).toBe(hash);
  });
  it("strips copy-paste noise: whitespace, newlines and surrounding quotes", () => {
    for (const raw of [` ${hash} `, `${hash}\n`, `'${hash}'`, `"${hash}"`, ` "${hash}"\r\n`]) {
      const h = readPasswordHash(raw);
      expect(h).toBe(hash);
      expect(bcrypt.compareSync("correct horse battery", h!)).toBe(true);
    }
  });
  it("rejects missing, truncated or non-bcrypt values", () => {
    for (const raw of [undefined, "", "password123", hash.slice(0, -1), `ADMIN_PASSWORD_HASH=${hash}`]) {
      expect(readPasswordHash(raw)).toBeNull();
    }
  });
});
