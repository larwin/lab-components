import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Highlighter,
  Image,
  Italic,
  Link,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { FloatingToolbar, Slider, Toolbar, type ToolbarItemDef } from "@/framework/primitives";
import { MetricCard, PageHeader, Showcase } from "@/components/primitives";

export const Route = createFileRoute("/toolbar")({
  head: () => ({
    meta: [
      { title: "Toolbar — Forge" },
      {
        name: "description",
        content: "APG toolbar : un tabstop, roving, débordement « … », pilule flottante.",
      },
    ],
  }),
  component: ToolbarPage,
});

interface EditorFormat {
  marks: string[];
  align: string;
  size: string;
  highlight: boolean;
}

const INITIAL_FORMAT: EditorFormat = {
  marks: [],
  align: "left",
  size: "16",
  highlight: false,
};

const SIZE_OPTIONS = [
  { key: "12", label: "12 px" },
  { key: "14", label: "14 px" },
  { key: "16", label: "16 px" },
  { key: "20", label: "20 px" },
  { key: "24", label: "24 px" },
];

function ToolbarPage() {
  const [format, setFormat] = useState<EditorFormat>(INITIAL_FORMAT);
  const [past, setPast] = useState<EditorFormat[]>([]);
  const [future, setFuture] = useState<EditorFormat[]>([]);
  const [lastAction, setLastAction] = useState<string>("—");
  const [overflowCount, setOverflowCount] = useState(0);
  const [widthPct, setWidthPct] = useState(100);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const apply = (action: string, next: Partial<EditorFormat>) => {
    setPast((p) => [...p, format]);
    setFuture([]);
    setFormat((f) => ({ ...f, ...next }));
    setLastAction(action);
  };

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      setFuture((f) => [format, ...f]);
      setFormat(p[p.length - 1]);
      return p.slice(0, -1);
    });
    setLastAction("Annuler");
  };

  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      setPast((p) => [...p, format]);
      setFormat(f[0]);
      return f.slice(1);
    });
    setLastAction("Rétablir");
  };

  const formatGroup = (
    keys: readonly { key: string; label: string; icon: ReactNode; shortcut?: string }[],
  ): ToolbarItemDef => ({
    kind: "toggle-group",
    key: "marks",
    label: "Format",
    mode: "multiple",
    value: format.marks,
    onValueChange: (value) => apply("Format", { marks: value }),
    overflowPriority: 3,
    items: keys.map((k) => ({ ...k })),
  });

  const editorItems: ToolbarItemDef[] = [
    {
      kind: "button",
      key: "undo",
      label: "Annuler",
      icon: <Undo2 className="size-4" />,
      disabled: past.length === 0,
      shortcut: "Mod+Z",
      overflowPriority: 2,
      onPress: undo,
    },
    {
      kind: "button",
      key: "redo",
      label: "Rétablir",
      icon: <Redo2 className="size-4" />,
      disabled: future.length === 0,
      shortcut: "Mod+Shift+Z",
      overflowPriority: 2,
      onPress: redo,
    },
    { kind: "separator", key: "sep-1" },
    formatGroup([
      { key: "bold", label: "Gras", icon: <Bold className="size-4" />, shortcut: "Mod+B" },
      { key: "italic", label: "Italique", icon: <Italic className="size-4" />, shortcut: "Mod+I" },
      {
        key: "underline",
        label: "Souligné",
        icon: <Underline className="size-4" />,
        shortcut: "Mod+U",
      },
    ]),
    { kind: "separator", key: "sep-2" },
    {
      kind: "toggle-group",
      key: "align",
      label: "Alignement",
      mode: "single",
      value: [format.align],
      onValueChange: (value) => apply("Alignement", { align: value[0] ?? "left" }),
      overflowPriority: 1,
      items: [
        { key: "left", label: "Aligner à gauche", icon: <AlignLeft className="size-4" /> },
        { key: "center", label: "Centrer", icon: <AlignCenter className="size-4" /> },
        { key: "right", label: "Aligner à droite", icon: <AlignRight className="size-4" /> },
      ],
    },
    { kind: "separator", key: "sep-3" },
    {
      kind: "select",
      key: "size",
      label: "Taille du texte",
      options: SIZE_OPTIONS,
      value: format.size,
      onValueChange: (value) => apply("Taille", { size: value ?? "16" }),
      overflowPriority: 1,
    },
    { kind: "separator", key: "sep-4" },
    {
      kind: "button",
      key: "link",
      label: "Insérer un lien",
      icon: <Link className="size-4" />,
      onPress: () => setLastAction("Insérer un lien"),
    },
    {
      kind: "button",
      key: "image",
      label: "Insérer une image",
      icon: <Image className="size-4" />,
      onPress: () => setLastAction("Insérer une image"),
    },
    {
      kind: "button",
      key: "code",
      label: "Bloc de code",
      icon: <Code className="size-4" />,
      onPress: () => setLastAction("Bloc de code"),
    },
  ];

  const pillItems: ToolbarItemDef[] = [
    {
      kind: "toggle-group",
      key: "marks",
      label: "Format",
      mode: "multiple",
      value: format.marks,
      onValueChange: (value) => apply("Format (pilule)", { marks: value }),
      items: [
        { key: "bold", label: "Gras", icon: <Bold className="size-4" /> },
        { key: "italic", label: "Italique", icon: <Italic className="size-4" /> },
      ],
    },
    { kind: "separator", key: "pill-sep" },
    {
      kind: "toggle-group",
      key: "highlight",
      label: "Surlignage",
      mode: "single",
      value: format.highlight ? ["highlight"] : [],
      onValueChange: (value) =>
        apply("Surlignage (pilule)", { highlight: value.includes("highlight") }),
      items: [{ key: "highlight", label: "Surligner", icon: <Highlighter className="size-4" /> }],
    },
  ];

  const rtlItems: ToolbarItemDef[] = [
    {
      kind: "button",
      key: "rtl-bold",
      label: "غامق (gras)",
      icon: <Bold className="size-4" />,
      onPress: () => setLastAction("RTL : gras"),
    },
    {
      kind: "button",
      key: "rtl-italic",
      label: "مائل (italique)",
      icon: <Italic className="size-4" />,
      onPress: () => setLastAction("RTL : italique"),
    },
    {
      kind: "button",
      key: "rtl-link",
      label: "رابط (lien)",
      icon: <Link className="size-4" />,
      onPress: () => setLastAction("RTL : lien"),
    },
  ];

  const editorStyle = {
    fontSize: `${format.size}px`,
    textAlign: format.align as "left" | "center" | "right",
  };

  const editorClass = cn(
    "rounded-lg border border-border bg-surface p-4 leading-relaxed transition-all select-text",
    format.marks.includes("bold") && "font-bold",
    format.marks.includes("italic") && "italic",
    format.marks.includes("underline") && "underline",
    format.highlight && "bg-yellow-100 dark:bg-yellow-900/40",
  );

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Toolbar"
        description={
          <>
            Vague 9a : la barre est la machine Navigable(horizontal) existante — UN tabstop, roving
            sur de vrais boutons (le pattern Accordion), ←/→ circulent, Home/End, flip RTL. Le
            débordement « … » est la politique pure <code>partitionOverflow</code> (largeurs
            mesurées injectées, priorité par item) et le menu qui s&apos;ouvre est LA machine Menu
            inchangée. Les items débordés restent montés : leurs raccourcis restent actifs.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Largeur du conteneur" value={widthPct} unit="%" />
        <MetricCard label="Items débordés" value={overflowCount} accent={overflowCount > 0} />
        <MetricCard label="Dernière action" value={lastAction} />
        <MetricCard label="Historique" value={past.length} unit="états" />
      </div>

      <div className="space-y-8">
        <Showcase
          title="Barre d'éditeur (statique) + débordement"
          description={
            <>
              Tab entre une seule fois dans la barre ; ←/→ circulent (wrap), les items désactivés
              (Annuler/Rétablir au départ) restent focalisables — pas de trou de navigation. ↑/↓
              restent réservés au Select. Rétrécissez le conteneur avec le slider : les items de
              moindre priorité partent dans « … » — Ctrl+B/Ctrl+I/Ctrl+Z fonctionnent toujours.
            </>
          }
        >
          <div className="space-y-4">
            <Slider
              min={30}
              max={100}
              step={5}
              value={widthPct}
              onValueChange={setWidthPct}
              formatValue={(v) => `${v} %`}
              aria-label="Largeur du conteneur de la toolbar"
              className="max-w-sm"
            />
            <div style={{ width: `${widthPct}%` }} className="min-w-40 transition-[width]">
              <Toolbar
                items={editorItems}
                aria-label="Mise en forme du document"
                onOverflowChange={(keys) => setOverflowCount(keys.length)}
              />
            </div>
            <div style={editorStyle} className={editorClass}>
              La barre d&apos;outils ci-dessus pilote ce paragraphe : gras, italique, souligné,
              alignement et taille s&apos;appliquent immédiatement. Chaque changement alimente
              l&apos;historique — Annuler/Rétablir se désactivent quand il est vide, tout en restant
              focalisables au clavier.
            </div>
          </div>
        </Showcase>

        <Showcase
          title="Pilule flottante sur sélection"
          description={
            <>
              Sélectionnez du texte ci-dessous : la pilule (le même composant Toolbar, ancré à la
              sélection par l&apos;Overlay via une ancre virtuelle — le pattern ContextMenu)
              apparaît au-dessus du texte sélectionné et se ferme dès que la sélection disparaît
              (clic ailleurs ou Échap).
            </>
          }
        >
          <div ref={editorRef} style={editorStyle} className={editorClass}>
            Ceci est l&apos;éditeur factice : sélectionnez n&apos;importe quelle phrase de ce
            paragraphe pour faire apparaître la pilule flottante. Gras et italique y sont le même
            ToggleGroup contrôlé que la barre statique — activer « gras » ici coche aussi le bouton
            de la barre du dessus, preuve que tout converge sur le même état.
          </div>
          <FloatingToolbar
            containerRef={editorRef}
            items={pillItems}
            aria-label="Mise en forme de la sélection"
          />
        </Showcase>

        <Showcase
          title="RTL : les flèches suivent le sens visuel"
          description={
            <>
              La même machine, <code>dir=&quot;rtl&quot;</code> : la frappe est retournée avant la
              résolution de keymap (<code>flipHorizontalStroke</code>, pure et testée en Node) — ←
              avance, → recule, exactement le sens visuel.
            </>
          }
        >
          <div className="flex justify-start">
            <Toolbar items={rtlItems} dir="rtl" aria-label="شريط الأدوات (RTL)" />
          </div>
        </Showcase>
      </div>
    </div>
  );
}
