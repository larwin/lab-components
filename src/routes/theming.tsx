import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/framework";
import { useTheme } from "@/themes/theme-provider";
import { TOKEN_GROUPS, SPACING_TOKENS, TYPOGRAPHY_TOKENS } from "@/themes/tokens";
import { PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/theming")({
  head: () => ({
    meta: [
      { title: "Theming — Forge" },
      { name: "description", content: "Design tokens, light/dark themes and theme switching." },
    ],
  }),
  component: Theming,
});

function Theming() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Design system"
        title="Theming"
        description="A token-driven system in oklch. Components never hardcode color — they reference semantic tokens, so light and dark modes come for free."
        actions={
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            <Button
              size="sm"
              variant={theme === "light" ? "primary" : "ghost"}
              onClick={() => setTheme("light")}
            >
              Light
            </Button>
            <Button
              size="sm"
              variant={theme === "dark" ? "primary" : "ghost"}
              onClick={() => setTheme("dark")}
            >
              Dark
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {TOKEN_GROUPS.map((group) => (
          <Showcase key={group.name} title={group.name} description={group.description}>
            <ul className="flex flex-col gap-2">
              {group.tokens.map((t) => (
                <li key={t.token} className="flex items-center gap-3">
                  <span
                    className="size-7 shrink-0 rounded-md border border-border"
                    style={{ background: `var(${t.token})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs">{t.token}</span>
                    <span className="block text-xs text-muted-foreground">{t.usage}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Showcase>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase title="Typography" description="Three font roles.">
          <ul className="flex flex-col gap-4">
            {TYPOGRAPHY_TOKENS.map((t) => (
              <li key={t.token}>
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  {t.label} · {t.family}
                </span>
                <p
                  className="text-2xl"
                  style={{ fontFamily: `var(${t.token})` }}
                >
                  The quick brown fox
                </p>
              </li>
            ))}
          </ul>
        </Showcase>

        <Showcase title="Spacing scale" description="Consistent rhythm.">
          <ul className="flex flex-col gap-2">
            {SPACING_TOKENS.map((s) => (
              <li key={s.token} className="flex items-center gap-3">
                <span className="h-4 rounded bg-primary" style={{ width: s.value }} />
                <span className="font-mono text-xs text-muted-foreground">
                  {s.token} · {s.value}
                </span>
              </li>
            ))}
          </ul>
        </Showcase>
      </div>
    </div>
  );
}
