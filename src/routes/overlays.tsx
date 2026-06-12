import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clipboard, Copy, Moon, Palette, Scissors, Search, Sun, Trash2 } from "lucide-react";
import { ShortcutProvider } from "@/framework/react";
import {
  Button,
  ComboBox,
  CommandPalette,
  Dialog,
  Menu,
  Popover,
  Tooltip,
  type CommandDef,
} from "@/framework/primitives";
import { useTheme } from "@/themes/theme-provider";
import { PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/overlays")({
  head: () => ({
    meta: [
      { title: "Overlays — Forge" },
      {
        name: "description",
        content: "Menus, combo boxes, dialogs and a command palette on one overlay engine.",
      },
    ],
  }),
  component: OverlaysPage,
});

const COUNTRIES = [
  "Allemagne",
  "Argentine",
  "Australie",
  "Autriche",
  "Belgique",
  "Brésil",
  "Canada",
  "Chili",
  "Chine",
  "Colombie",
  "Corée du Sud",
  "Danemark",
  "Égypte",
  "Espagne",
  "Estonie",
  "États-Unis",
  "Éthiopie",
  "Finlande",
  "France",
  "Grèce",
  "Hongrie",
  "Inde",
  "Indonésie",
  "Irlande",
  "Islande",
  "Italie",
  "Japon",
  "Kenya",
  "Lettonie",
  "Lituanie",
  "Luxembourg",
  "Maroc",
  "Mexique",
  "Norvège",
  "Nouvelle-Zélande",
  "Pays-Bas",
  "Pérou",
  "Pologne",
  "Portugal",
  "Roumanie",
  "Royaume-Uni",
  "Sénégal",
  "Suède",
  "Suisse",
  "Tchéquie",
  "Tunisie",
  "Turquie",
  "Ukraine",
  "Vietnam",
];

function OverlaysPage() {
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { toggleTheme } = useTheme();

  const commands: CommandDef[] = [
    {
      key: "theme",
      label: "Toggle theme",
      section: "Appearance",
      icon: <Sun className="size-4" />,
      shortcut: "Mod+Shift+L",
    },
    {
      key: "dark",
      label: "Switch to dark mode",
      section: "Appearance",
      icon: <Moon className="size-4" />,
      keywords: "night theme",
    },
    {
      key: "tokens",
      label: "Open design tokens",
      section: "Appearance",
      icon: <Palette className="size-4" />,
    },
    {
      key: "copy",
      label: "Copy selection",
      section: "Edit",
      icon: <Copy className="size-4" />,
      shortcut: "Mod+C",
    },
    {
      key: "cut",
      label: "Cut selection",
      section: "Edit",
      icon: <Scissors className="size-4" />,
      disabled: true,
    },
    {
      key: "paste",
      label: "Paste",
      section: "Edit",
      icon: <Clipboard className="size-4" />,
      shortcut: "Mod+V",
    },
    {
      key: "delete",
      label: "Delete dataset",
      section: "Danger",
      icon: <Trash2 className="size-4" />,
      keywords: "remove",
    },
  ];

  return (
    <ShortcutProvider>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Next-gen engine"
          title="Overlay System"
          description="One engine — portal, layer stack, outside-press cascade, focus trap & restore, pure positioning math (flip/shift), blocking shortcut scopes — behind menus, combo boxes, dialogs and the command palette. Press Mod+K anywhere on this page."
          actions={
            <Button variant="primary" shortcut="Mod+k" showShortcut onPress={() => undefined}>
              <Search className="size-4" />
              Command palette
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Showcase
            title="Menu = Focusable + Navigable + Actionable + Dismissable"
            description="ArrowDown on the trigger opens and focuses; disabled items are skipped; Enter activates and restores focus to the trigger. Sections and separators are collection nodes."
          >
            <div className="flex items-center gap-4">
              <Menu
                label="Edit"
                onAction={(key) => setLastAction(String(key))}
                sections={[
                  {
                    label: "Clipboard",
                    items: [
                      {
                        key: "copy",
                        label: "Copy",
                        icon: <Copy className="size-4" />,
                        shortcut: "Mod+C",
                      },
                      {
                        key: "cut",
                        label: "Cut",
                        icon: <Scissors className="size-4" />,
                        disabled: true,
                      },
                      {
                        key: "paste",
                        label: "Paste",
                        icon: <Clipboard className="size-4" />,
                        shortcut: "Mod+V",
                      },
                    ],
                  },
                  {
                    items: [
                      {
                        key: "delete",
                        label: "Delete",
                        icon: <Trash2 className="size-4" />,
                        destructive: true,
                      },
                    ],
                  },
                ]}
              />
              <span className="text-sm text-muted-foreground">
                {lastAction ? (
                  <>
                    last action: <span className="font-mono text-foreground">{lastAction}</span>
                  </>
                ) : (
                  "no action yet"
                )}
              </span>
            </div>
          </Showcase>

          <Showcase
            title="ComboBox = + Searchable"
            description="The query is machine state; the filtered collection feeds navigation transparently. Matching is culture-aware: try 'eta' → États-Unis, 'egy' → Égypte."
          >
            <div className="flex items-center gap-4">
              <ComboBox
                aria-label="Country"
                items={COUNTRIES}
                getKey={(c) => c}
                getTextValue={(c) => c}
                locale="fr"
                placeholder="Choose a country…"
                onSelectionChange={(key) => setCountry(key !== null ? String(key) : null)}
              />
              <span className="text-sm text-muted-foreground">
                {country ? (
                  <>
                    selected: <span className="font-medium text-foreground">{country}</span>
                  </>
                ) : (
                  "nothing selected"
                )}
              </span>
            </div>
          </Showcase>

          <Showcase
            title="Dialog — modal layer"
            description="Focus is trapped and restored; Escape and outside-press dismiss; while open, a blocking shortcut scope masks page shortcuts — Mod+K does nothing until you close it."
          >
            <div className="flex items-center gap-4">
              <Button variant="destructive" onPress={() => setDialogOpen(true)}>
                Delete dataset…
              </Button>
              {confirmed && (
                <span className="text-sm text-muted-foreground">dataset deleted (not really)</span>
              )}
            </div>
            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title="Delete this dataset?"
              description="This action cannot be undone. The 500k seeded rows will be regenerated identically anyway."
              footer={
                <>
                  <Button onPress={() => setDialogOpen(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onPress={() => {
                      setConfirmed(true);
                      setDialogOpen(false);
                    }}
                  >
                    Delete
                  </Button>
                </>
              }
            >
              <p className="text-muted-foreground">
                Try pressing{" "}
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
                  Mod+K
                </kbd>{" "}
                now — the palette shortcut is masked by this modal's blocking scope.
              </p>
            </Dialog>
          </Showcase>

          <Showcase
            title="Tooltip & Popover"
            description="Tooltips wait 600 ms, then stay 'warm': move between the buttons and the next one opens instantly. The popover is a Dismissable machine on the same Overlay engine — focus moves in and is restored on close."
          >
            <div className="flex items-center gap-4">
              <Tooltip content="Copies the current selection" placement="top">
                <button
                  type="button"
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
                >
                  Copy
                </button>
              </Tooltip>
              <Tooltip content="Pastes from the clipboard" placement="top">
                <button
                  type="button"
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring outline-none"
                >
                  Paste
                </button>
              </Tooltip>
              <Popover trigger="Details" aria-label="Dataset details" placement="bottom-start">
                <p className="font-medium">Seeded dataset</p>
                <p className="mt-1 text-muted-foreground">
                  500k generated products, deterministic seed, regenerated per size on demand.
                  Escape or outside-press closes this popover; focus returns to the trigger.
                </p>
              </Popover>
            </div>
          </Showcase>

          <Showcase
            title="Command palette — global shortcut, modal search"
            description="Opened by Mod+K from anywhere on the page (scope-aware). Filtering goes through the same culture-aware collator as everything else."
          >
            <p className="text-sm text-muted-foreground">
              Press{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                Mod+K
              </kbd>{" "}
              or the header button. Running “Toggle theme” actually toggles the theme.
            </p>
          </Showcase>
        </div>

        <CommandPalette
          commands={commands}
          onRun={(key) => {
            setLastAction(String(key));
            if (key === "theme" || key === "dark") toggleTheme();
          }}
        />
      </div>
    </ShortcutProvider>
  );
}
