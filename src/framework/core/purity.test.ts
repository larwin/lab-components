// @vitest-environment node
// Architecture guard — the rules in RFC-001 §3, enforced by CI:
//   1. src/framework/core never imports React or react-dom.
//   2. src/framework/canvas (the second adapter) never imports React either —
//      it must depend only on the core, proving the renderer boundary.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const listSourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...listSourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.")) out.push(path);
  }
  return out;
};

const REACT_IMPORT = /from\s+["'](react|react-dom)(\/|["'])/;

const offenders = (root: string): string[] =>
  listSourceFiles(root).filter((file) => REACT_IMPORT.test(readFileSync(file, "utf8")));

describe("architecture purity", () => {
  it("src/framework/core imports no React", () => {
    expect(offenders(join(process.cwd(), "src/framework/core"))).toEqual([]);
  });

  it("src/framework/canvas (renderer adapter #2) imports no React", () => {
    expect(offenders(join(process.cwd(), "src/framework/canvas"))).toEqual([]);
  });

  it("the grid machine shared by both adapters imports no React", () => {
    const file = join(process.cwd(), "src/framework/primitives/datagrid/gridMachine.ts");
    expect(REACT_IMPORT.test(readFileSync(file, "utf8"))).toBe(false);
  });

  it("src/framework/services (DI + stores layer, RFC-002) imports no React", () => {
    expect(offenders(join(process.cwd(), "src/framework/services"))).toEqual([]);
  });
});
