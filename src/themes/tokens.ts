/**
 * Design token reference.
 *
 * The source of truth for token *values* is `src/styles.css`. This module is a
 * typed, documentation-friendly catalogue of the semantic tokens so the
 * playground (and future tooling) can enumerate them. Keep names in sync.
 */

export interface TokenGroup {
  name: string;
  description: string;
  tokens: { token: string; usage: string }[];
}

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    name: "Surfaces",
    description: "Background layers and elevated panels.",
    tokens: [
      { token: "--background", usage: "App background" },
      { token: "--surface", usage: "Elevated panels" },
      { token: "--card", usage: "Cards and containers" },
      { token: "--muted", usage: "Subtle fills" },
    ],
  },
  {
    name: "Brand",
    description: "Primary identity colors and gradient.",
    tokens: [
      { token: "--brand", usage: "Primary accent (teal)" },
      { token: "--brand-2", usage: "Secondary accent (green)" },
      { token: "--primary", usage: "Interactive primary" },
      { token: "--ring", usage: "Focus rings" },
    ],
  },
  {
    name: "Feedback",
    description: "Status and semantic colors.",
    tokens: [
      { token: "--success", usage: "Positive states" },
      { token: "--warning", usage: "Caution states" },
      { token: "--destructive", usage: "Errors / danger" },
    ],
  },
];

export const SPACING_TOKENS = [
  { token: "space-1", value: "0.25rem" },
  { token: "space-2", value: "0.5rem" },
  { token: "space-3", value: "0.75rem" },
  { token: "space-4", value: "1rem" },
  { token: "space-6", value: "1.5rem" },
  { token: "space-8", value: "2rem" },
  { token: "space-12", value: "3rem" },
];

export const TYPOGRAPHY_TOKENS = [
  { token: "--font-sans", label: "Display", family: "Space Grotesk" },
  { token: "--font-body", label: "Body", family: "DM Sans" },
  { token: "--font-mono", label: "Mono", family: "JetBrains Mono" },
];
