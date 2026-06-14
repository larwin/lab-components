import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertDialog,
  Breadcrumbs,
  Button,
  Drawer,
  Menubar,
  Pagination,
  Splitter,
  TextField,
  type DrawerSide,
} from "@/framework/primitives";
import { MetricCard, PageHeader, Showcase } from "@/components/primitives";

export const Route = createFileRoute("/surfaces")({
  head: () => ({
    meta: [
      { title: "Surfaces & navigation — Forge" },
      {
        name: "description",
        content: "Drawer, AlertDialog, Pagination, Breadcrumbs, Menubar, Splitter.",
      },
    ],
  }),
  component: SurfacesPage,
});

const BREADCRUMB_PATH = [
  { key: "root", label: "Racine", href: "#" },
  { key: "org", label: "Organisation", href: "#" },
  { key: "dept", label: "Département", href: "#" },
  { key: "team", label: "Équipe Forge", href: "#" },
  { key: "project", label: "lab-components", href: "#" },
  { key: "branch", label: "main", href: "#" },
  { key: "file", label: "RFC-001.md" },
];

const MENUBAR_MENUS = [
  {
    key: "file",
    label: "Fichier",
    sections: [
      {
        items: [
          { key: "new", label: "Nouveau", shortcut: "Mod+N" },
          { key: "open", label: "Ouvrir…", shortcut: "Mod+O" },
          { key: "save", label: "Enregistrer", shortcut: "Mod+S" },
        ],
      },
      { items: [{ key: "quit", label: "Quitter", destructive: true }] },
    ],
  },
  {
    key: "edit",
    label: "Édition",
    sections: [
      {
        items: [
          { key: "undo", label: "Annuler", shortcut: "Mod+Z" },
          { key: "redo", label: "Rétablir", shortcut: "Mod+Shift+Z" },
          { key: "paste", label: "Coller", disabled: true },
        ],
      },
    ],
  },
  {
    key: "view",
    label: "Affichage",
    sections: [
      {
        items: [
          { key: "zoom-in", label: "Zoom avant", shortcut: "Mod+Plus" },
          { key: "zoom-out", label: "Zoom arrière", shortcut: "Mod+Minus" },
          { key: "fullscreen", label: "Plein écran" },
        ],
      },
    ],
  },
];

function SurfacesPage() {
  const [drawerSide, setDrawerSide] = useState<DrawerSide | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [lastCrumb, setLastCrumb] = useState<string | null>(null);
  const [lastMenuAction, setLastMenuAction] = useState<string | null>(null);
  const [split, setSplit] = useState(50);

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Surfaces & navigation"
        description={
          <>
            Vague 5 : le Drawer est le moteur Overlay ancré à un bord (focus trap, pile de layers et
            scope bloquant déjà fournis) ; la Pagination est une machine pure dont la fenêtre
            d&apos;ellipses est calculée dans le core ; le Menubar fait suivre le panneau au focus
            de la barre (← → traversent les menus ouverts) ; le Splitter réutilise la machine
            NumericValue de Slider/Rating — pointeur et clavier convergent sur les mêmes intents.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Tests Node ajoutés" value="23" unit="machines, zéro DOM" accent />
        <MetricCard label="Nouvelles machines" value="1" unit="Pagination (createMachine)" />
        <MetricCard label="NumericValue réutilisée" value="4×" unit="NumberField → Splitter" />
        <MetricCard label="Machine Menu réutilisée" value="3×" unit="Menu, Breadcrumbs, Menubar" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="Drawer — Overlay ancré à un bord"
          description="Trois ancrages, même moteur : backdrop, focus trap (Tab boucle), Escape et clic extérieur ferment, le focus revient au déclencheur. Le scope de raccourcis bloquant masque Mod+K."
        >
          <div className="flex flex-wrap gap-2">
            <Button onPress={() => setDrawerSide("left")}>Gauche</Button>
            <Button onPress={() => setDrawerSide("right")}>Droite</Button>
            <Button onPress={() => setDrawerSide("bottom")}>Bas</Button>
          </div>
          <Drawer
            open={drawerSide !== null}
            onOpenChange={() => setDrawerSide(null)}
            side={drawerSide ?? "right"}
            title="Paramètres du projet"
            description="Un formulaire dans un panneau latéral."
            footer={<Button onPress={() => setDrawerSide(null)}>Fermer</Button>}
          >
            <div className="flex flex-col gap-4 pt-2">
              <TextField label="Nom du projet" defaultValue="lab-components" />
              <TextField label="Description" placeholder="Décrivez le projet…" />
            </div>
          </Drawer>
        </Showcase>

        <Showcase
          title="AlertDialog — choix obligatoire"
          description="role=alertdialog : pas de fermeture par clic extérieur ni Escape (prop dismissable). Le focus initial atterrit sur l'action la moins destructive (Annuler, data-autofocus)."
        >
          <div className="flex items-center gap-3">
            <Button variant="destructive" onPress={() => setAlertOpen(true)}>
              Supprimer le projet…
            </Button>
            <span className="font-mono text-xs text-muted-foreground">
              {deleted ? "supprimé ✓ (simulation)" : "—"}
            </span>
          </div>
          <AlertDialog
            open={alertOpen}
            onOpenChange={setAlertOpen}
            title="Supprimer définitivement ?"
            description="Cette action est irréversible. Les 42 composants du projet seront perdus."
            actionLabel="Supprimer"
            destructive
            onAction={() => setDeleted(true)}
          />
        </Showcase>

        <Showcase
          title="Pagination — fenêtre d'ellipses calculée dans le core"
          description="237 éléments, 10 par page = 24 pages. La fenêtre (1 … 9 10 11 … 24) vient de paginationRange, pur et testé. aria-current=page sur la page active ; les bords se désactivent."
        >
          <div className="flex flex-col gap-3">
            <Pagination total={237} pageSize={10} page={page} onPageChange={setPage} showEdges />
            <p className="font-mono text-xs text-muted-foreground">
              page = {page} / {Math.ceil(237 / 10)}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Breadcrumbs — collapse en menu « … »"
          description="7 segments, 4 visibles : la racine reste, le milieu part dans un menu réutilisant la machine Menu (flèches, typeahead, Escape, restauration du focus). aria-current=page sur le dernier."
        >
          <div className="flex flex-col gap-3">
            <Breadcrumbs
              items={BREADCRUMB_PATH}
              maxVisible={4}
              onNavigate={(key) => setLastCrumb(String(key))}
            />
            <p className="font-mono text-xs text-muted-foreground">
              Dernière navigation : {lastCrumb ?? "—"}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Menubar — le panneau suit le focus de la barre"
          description="Pattern APG : ← → traversent les menus (même ouverts — le panneau suit sans se fermer), ↓/Enter ouvre, survol d'un autre menu quand un est ouvert le bascule, Escape ferme et rend le focus."
        >
          <div className="flex flex-col gap-3">
            <Menubar
              menus={MENUBAR_MENUS}
              onAction={(menu, item) => setLastMenuAction(`${menu}/${item}`)}
            />
            <p className="font-mono text-xs text-muted-foreground">
              Dernière action : {lastMenuAction ?? "—"}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Splitter — NumericValue, encore"
          description="Glissez le séparateur ou prenez-le au clavier (← → ↑ ↓, Shift = ±10, Home/End = bornes 15/85 %) : mêmes intents number/set. Double-clic = retour à 50 %. role=separator avec aria-valuenow."
        >
          <div className="flex flex-col gap-3">
            <div className="h-40 overflow-hidden rounded-lg border border-border">
              <Splitter defaultValue={50} onValueChange={(v) => setSplit(Math.round(v))}>
                <div className="flex h-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
                  Panneau A
                </div>
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Panneau B
                </div>
              </Splitter>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {split} % – {100 - split} %
            </p>
          </div>
        </Showcase>
      </div>
    </div>
  );
}
