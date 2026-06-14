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

/** Module specifiers imported by a file (`from "…"`). */
const importsOf = (file: string): string[] => {
  const src = readFileSync(file, "utf8");
  const re = /from\s+["']([^"']+)["']/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
};

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

// Layer boundaries (RFC-003 §10): applications → domains → framework, one-way.
// Proven by CI, not discipline.
describe("architecture layering (RFC-003)", () => {
  const src = (p: string) => join(process.cwd(), p);

  it("src/domains is pure — imports no React", () => {
    expect(offenders(src("src/domains"))).toEqual([]);
  });

  it("framework imports no business layer (@/domains, @/applications, @/app, @/platform)", () => {
    const bad = listSourceFiles(src("src/framework")).filter((f) =>
      importsOf(f).some((i) => /^@\/(domains|applications|app|platform)(\/|$)/.test(i)),
    );
    expect(bad).toEqual([]);
  });

  it("domains import no application or composition layer (@/applications, @/app)", () => {
    const bad = listSourceFiles(src("src/domains")).filter((f) =>
      importsOf(f).some((i) => /^@\/(applications|app)(\/|$)/.test(i)),
    );
    expect(bad).toEqual([]);
  });

  it("a domain reaches another domain only via its public barrel (no deep import)", () => {
    const root = src("src/domains");
    const bad: string[] = [];
    for (const file of listSourceFiles(root)) {
      const rel = file.slice(root.length + 1).replace(/\\/g, "/");
      const own = rel.split("/")[0];
      for (const imp of importsOf(file)) {
        const m = imp.match(/^@\/domains\/([^/]+)\/.+/); // deep import into a domain
        // `technical/*` (http, telemetry…) are shared infra domains: any business
        // domain may inject them, so they are exempt from the cross-domain barrel rule.
        if (m && m[1] !== own && m[1] !== "technical") bad.push(`${rel} → ${imp}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("an application reaches another application only via its public barrel", () => {
    const root = src("src/applications");
    const bad: string[] = [];
    for (const file of listSourceFiles(root)) {
      const rel = file.slice(root.length + 1).replace(/\\/g, "/");
      const own = rel.split("/")[0];
      for (const imp of importsOf(file)) {
        const m = imp.match(/^@\/applications\/([^/]+)\/.+/);
        if (m && m[1] !== own) bad.push(`${rel} → ${imp}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
