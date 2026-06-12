/**
 * Regenerates src/framework/core/time/windows-zones.ts from the CLDR
 * windowsZones supplemental table (the canonical Windows ↔ IANA mapping,
 * maintained by Unicode).
 *
 *   bun scripts/generate-windows-zones.ts
 *
 * Source: https://raw.githubusercontent.com/unicode-org/cldr/main/common/supplemental/windowsZones.xml
 * The generated module is versioned in the repo (no network at runtime, no
 * build step) and OPTIONAL: nothing else in the core imports it — consumers
 * who don't need Windows ids never ship it (tree-shaking on a leaf module).
 */

const SOURCE_URL =
  "https://raw.githubusercontent.com/unicode-org/cldr/main/common/supplemental/windowsZones.xml";
const TARGET = new URL("../src/framework/core/time/windows-zones.ts", import.meta.url);

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`CLDR fetch failed: ${response.status} ${response.statusText}`);
}
const xml = await response.text();

// <mapZone other="Romance Standard Time" territory="001" type="Europe/Paris"/>
const MAP_ZONE = /<mapZone\s+other="([^"]+)"\s+territory="([^"]+)"\s+type="([^"]+)"\s*\/>/g;
const table = new Map<string, Map<string, string[]>>();
let match: RegExpExecArray | null;
let count = 0;
while ((match = MAP_ZONE.exec(xml)) !== null) {
  const [, windowsId, territory, zones] = match;
  let territories = table.get(windowsId);
  if (!territories) {
    territories = new Map();
    table.set(windowsId, territories);
  }
  territories.set(territory, zones.split(" "));
  count++;
}
if (count === 0) throw new Error("No mapZone entries parsed — did the CLDR format change?");

const entries = [...table.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([windowsId, territories]) => {
    const lines = [...territories.entries()]
      .sort(([a], [b]) => (a === "001" ? -1 : b === "001" ? 1 : a.localeCompare(b)))
      .map(([territory, zones]) => `    ${JSON.stringify(territory)}: ${JSON.stringify(zones)},`)
      .join("\n");
    return `  ${JSON.stringify(windowsId)}: {\n${lines}\n  },`;
  })
  .join("\n");

const generated = `/**
 * Windows ↔ IANA timezone mapping — GENERATED, do not edit by hand.
 *
 * Source: CLDR supplemental windowsZones table
 *   ${SOURCE_URL}
 * Regenerate with: bun scripts/generate-windows-zones.ts
 * Generated: ${new Date().toISOString().slice(0, 10)} — ${count} mapZone entries.
 *
 * This module is OPTIONAL and tree-shakable: nothing else in the core
 * imports it. Territory "001" is CLDR's world default for a Windows id; the
 * first zone of a territory list is its canonical representative.
 */

type WindowsZoneTable = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

const WINDOWS_ZONES: WindowsZoneTable = {
${entries}
};

/** The IANA zone a Windows timezone id denotes (territory-aware, "001" default). */
export function ianaFromWindows(windowsId: string, territory = "001"): string | null {
  const territories = WINDOWS_ZONES[windowsId];
  if (!territories) return null;
  const zones = territories[territory] ?? territories["001"];
  return zones?.[0] ?? null;
}

let reverse: Map<string, string> | null = null;

/** The Windows timezone id covering an IANA zone (links resolve via CLDR lists). */
export function windowsFromIana(ianaId: string): string | null {
  if (!reverse) {
    reverse = new Map();
    for (const [windowsId, territories] of Object.entries(WINDOWS_ZONES)) {
      for (const zones of Object.values(territories)) {
        for (const zone of zones) {
          if (!reverse.has(zone)) reverse.set(zone, windowsId);
        }
      }
    }
  }
  return reverse.get(ianaId) ?? null;
}

/** Every Windows timezone id in the table (UI pickers). */
export function windowsTimeZoneIds(): string[] {
  return Object.keys(WINDOWS_ZONES);
}
`;

await Bun.write(TARGET.pathname.replace(/^\/(?=[A-Za-z]:)/, ""), generated);
console.log(`windows-zones.ts: ${table.size} Windows ids, ${count} mapZone entries.`);
