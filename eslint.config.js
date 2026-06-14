import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `experimentations/` is an exploratory sandbox (see CLAUDE.md) — not held
  // to the framework's lint standards.
  { ignores: ["dist", ".output", ".vinxi", "experimentations"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Layer boundaries (RFC-003 §10). The architecture test (purity.test.ts) is the
  // exhaustive guard, incl. the cross-domain "barrel only" rule; these give fast
  // editor feedback for the coarse, one-directional layering.
  {
    files: ["src/framework/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/domains/*", "@/features/*", "@/app/*"],
              message:
                "The framework is the stability boundary — it must not import business layers (domains/features/app).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/domains/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/app/*"],
              message:
                "A domain owns its data and must not depend on the feature or composition layer. Cross-domain deps go through a public barrel (@/domains/<other>).",
            },
          ],
        },
      ],
    },
  },
  eslintPluginPrettier,
);
