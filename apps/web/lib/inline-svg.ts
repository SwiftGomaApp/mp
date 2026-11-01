import { readFileSync } from "node:fs";
import path from "node:path";

const DRAWN = /<(?:path|circle|rect|ellipse)\b[^>]*\/>/g;

export interface SvgWrap {
  from: number;
  to: number;
  open: string;
  close?: string;
}

export function inlineSvg(
  file: string,
  wraps: SvgWrap[],
  insertBefore: Record<number, string> = {},
) {
  const before: Record<number, string> = { ...insertBefore };
  const after: Record<number, string> = {};
  for (const { from, to, open, close = "</g>" } of wraps) {
    before[from] = (before[from] ?? "") + open;
    after[to] = close + (after[to] ?? "");
  }

  let index = -1;
  return readFileSync(path.join(process.cwd(), "public", file), "utf8")
    .replace(DRAWN, (shape) => {
      index += 1;
      return (before[index] ?? "") + shape + (after[index] ?? "");
    })
    .replace(/ width="[\d.]+" height="[\d.]+"/, ' class="h-auto w-full"')
    .replace(' role="img"', ' aria-hidden="true"');
}
