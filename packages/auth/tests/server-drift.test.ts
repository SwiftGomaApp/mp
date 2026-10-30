/// <reference types="node" />
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { ERROR_CODES } from "../src/index";

const SERVER_SRC =
  process.env.SERVER_SRC ?? fileURLToPath(new URL("../../../server/src", import.meta.url));

const HELPERS: Record<string, [number, string]> = {
  badRequest: [2, "BAD_REQUEST"],
  unauthorized: [1, "UNAUTHORIZED"],
  forbidden: [1, "FORBIDDEN"],
  notFound: [1, "NOT_FOUND"],
  conflict: [1, "CONFLICT"],
  tooManyRequests: [1, "TOO_MANY_REQUESTS"],
  internal: [1, "INTERNAL_ERROR"],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });
}

function readArgs(text: string, start: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (let i = start; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (quote) {
      current += ch;
      if (ch === "\\") current += text.charAt(++i);
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
    } else if ("([{".includes(ch)) {
      depth += 1;
      current += ch;
    } else if (")]}".includes(ch)) {
      if (depth === 0) {
        if (current.trim()) args.push(current.trim());
        return args;
      }
      depth -= 1;
      current += ch;
    } else if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  return args;
}

function literal(arg: string | undefined): string | null {
  const match = arg?.match(/^(["'`])([\s\S]*)\1$/);
  return match?.[2] ?? null;
}

function serverCodes(): Set<string> {
  const codes = new Set<string>();
  for (const file of sourceFiles(SERVER_SRC)) {
    const text = readFileSync(file, "utf8");

    for (const match of text.matchAll(/AppError\.(\w+)\(/g)) {
      const helper = HELPERS[match[1] ?? ""];
      if (!helper) continue;
      const raw = readArgs(text, (match.index ?? 0) + match[0].length)[helper[0]];
      const code = raw === undefined ? helper[1] : literal(raw);
      if (code) codes.add(code);
    }

    for (const match of text.matchAll(/new AppError\(/g)) {
      const code = literal(readArgs(text, (match.index ?? 0) + match[0].length)[1]);
      if (code) codes.add(code);
    }
  }
  return codes;
}

const RAISED_ELSEWHERE = new Set(["BAD_REQUEST", "INTERNAL_ERROR"]);

describe.skipIf(!existsSync(SERVER_SRC))("server error codes", () => {
  const catalogue = new Set(Object.keys(ERROR_CODES));
  let server = new Set<string>();

  beforeAll(() => {
    server = serverCodes();
  });

  it("finds the codes in the server source", () => {
    expect(server.size).toBeGreaterThan(50);
  });

  it("lists every code the server can return", () => {
    const missing = [...server].filter((code) => !catalogue.has(code)).sort();
    expect(missing, "add these to ERROR_CODES in src/core/error-codes.ts").toEqual([]);
  });

  it("no longer lists a code the server stopped returning", () => {
    const stale = [...catalogue]
      .filter((code) => !server.has(code) && !RAISED_ELSEWHERE.has(code))
      .sort();
    expect(stale, "remove these from ERROR_CODES, or fix the scan above").toEqual([]);
  });
});
