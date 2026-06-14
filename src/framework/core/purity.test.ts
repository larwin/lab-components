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

// Layer boundaries (RFC-004 §7, ex RFC-003 §10): features → domains → framework,
// one-way; the composition root (WebApplication/WebTest) sits above everything.
// Proven by CI, not discipline.
describe("architecture layering (RFC-004)", () => {
  const src = (p: string) => join(process.cwd(), p);

  // A "domain" is the unit that owns its data and exposes a public barrel.
  // Under the RFC-004 layout that is:
  //   business/<context>/<domain>   (e.g. business/campaign/categories)
  //   technical/<domain>            (e.g. technical/telemetry)
  // The domain root is the prefix that addresses that barrel; anything deeper is
  // an internal file. `segs` are the path segments AFTER `domains/`.
  const domainRootSegs = (segs: string[]): string[] => {
    if (segs[0] === "business") return segs.slice(0, 3);
    if (segs[0] === "technical") return segs.slice(0, 2);
    return segs.slice(0, 1);
  };

  it("src/domains is pure — imports no React", () => {
    expect(offenders(src("src/domains"))).toEqual([]);
  });

  it("framework imports no business layer nor the composition root", () => {
    const bad = listSourceFiles(src("src/framework")).filter((f) =>
      importsOf(f).some((i) =>
        /^@\/(domains|features)(\/|$)|^@\/Web(Application|Test)(\/|$)/.test(i),
      ),
    );
    expect(bad).toEqual([]);
  });

  it("domains import no feature nor the composition root (WebApplication/WebTest)", () => {
    const bad = listSourceFiles(src("src/domains")).filter((f) =>
      importsOf(f).some((i) => /^@\/features(\/|$)|^@\/Web(Application|Test)(\/|$)/.test(i)),
    );
    expect(bad).toEqual([]);
  });

  it("a domain reaches another domain only via its public barrel (no deep import)", () => {
    const root = src("src/domains");
    const bad: string[] = [];
    for (const file of listSourceFiles(root)) {
      const rel = file.slice(root.length + 1).replace(/\\/g, "/");
      const ownRoot = domainRootSegs(rel.split("/")).join("/");
      for (const imp of importsOf(file)) {
        const m = imp.match(/^@\/domains\/(.+)$/);
        if (!m) continue;
        const segs = m[1].split("/");
        // `technical/*` (http, telemetry…) are shared infra domains: any domain
        // may inject them, so they are exempt from the cross-domain barrel rule.
        if (segs[0] === "technical") continue;
        const importedRoot = domainRootSegs(segs).join("/");
        const isDeep = segs.length > domainRootSegs(segs).length; // past the barrel
        if (importedRoot !== ownRoot && isDeep) bad.push(`${rel} → ${imp}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("a feature reaches another feature only via its public barrel", () => {
    const root = src("src/features");
    const bad: string[] = [];
    for (const file of listSourceFiles(root)) {
      const rel = file.slice(root.length + 1).replace(/\\/g, "/");
      const own = rel.split("/")[0];
      for (const imp of importsOf(file)) {
        const m = imp.match(/^@\/features\/([^/]+)\/.+/);
        if (m && m[1] !== own) bad.push(`${rel} → ${imp}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
