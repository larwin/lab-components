import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, FolderOpen, Pencil, Scissors, Share2, Trash2 } from "lucide-react";
import type { Key } from "@/framework/core";
import { Accordion, ContextMenu, Select, Tabs } from "@/framework/primitives";
import { MetricCard, PageHeader, Showcase } from "@/components/primitives";

export const Route = createFileRoute("/disclosure")({
  head: () => ({
    meta: [
      { title: "Navigation & Disclosure — Forge" },
      {
        name: "description",
        content:
          "Tabs, Accordion, Select and ContextMenu on the same collection + overlay engines.",
      },
    ],
  }),
  component: DisclosurePage,
});

const PLANS = [
  { key: "starter", label: "Starter", description: "1 utilisateur, 1 Go" },
  { key: "team", label: "Team", description: "10 utilisateurs, 100 Go" },
  { key: "business", label: "Business", description: "Illimité, SSO" },
  { key: "legacy", label: "Legacy", description: "N'est plus commercialisé", disabled: true },
  { key: "enterprise", label: "Enterprise", description: "Sur devis" },
];

function DisclosurePage() {
  const [plan, setPlan] = useState<Key | null>("team");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [activation, setActivation] = useState<"automatic" | "manual">("automatic");

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Navigation & Disclosure"
        description={
          <>
            Quatre composants, zéro nouvelle logique : Tabs et Accordion sont le collection engine
            (Navigable + Selectable / Expandable), Select est la machine listbox derrière un bouton,
            ContextMenu est la machine Menu déclenchée au clic droit. Tout a été testé en Node avant
            d&apos;avoir un rendu.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Nouveaux behaviors" value="0" unit="tout est réutilisé" accent />
        <MetricCard label="Ajout au core" value="1" unit="expansionMode single" />
        <MetricCard label="Machine partagée" value="Menu" unit="= ContextMenu" />
        <MetricCard label="Tests machines" value="10" unit="Tabs · Accordion · Select" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="Tabs — activation automatique ou manuelle"
          description="La différence entre les deux modes est UN flag de config de la même machine : selectionFollowsFocus. En automatique, les flèches activent ; en manuel, elles déplacent le focus et Entrée/Espace active."
        >
          <div className="flex flex-col gap-4">
            <Tabs
              aria-label="Mode d'activation"
              tabs={[
                { key: "automatic", label: "Automatique", content: "" },
                { key: "manual", label: "Manuel", content: "" },
              ]}
              value={activation}
              onValueChange={(k) => k && setActivation(k as "automatic" | "manual")}
            />
            <Tabs
              aria-label="Paramètres"
              activation={activation}
              tabs={[
                {
                  key: "general",
                  label: "Général",
                  content:
                    "Tab entre dans la tablist sur l'onglet actif ; ← → naviguent (wrap), Home/End sautent aux extrémités.",
                },
                {
                  key: "billing",
                  label: "Facturation",
                  content:
                    activation === "manual"
                      ? "Mode manuel : cet onglet ne s'est activé que sur Entrée/Espace."
                      : "Mode automatique : cet onglet s'est activé dès que la flèche l'a focalisé.",
                },
                { key: "team", label: "Équipe", content: "Le panneau est focusable (tabIndex=0)." },
                { key: "archived", label: "Archives", content: "", disabled: true },
              ]}
            />
          </div>
        </Showcase>

        <Showcase
          title="Select — listbox + Overlay + typeahead"
          description="Ouvrez puis tapez « b » ou « en » : le typeahead culture-aware de Navigable saute à l'option. Entrée sélectionne et referme (focus restauré sur le bouton, effet déclaratif). Legacy est désactivé : navigation et sélection le sautent."
        >
          <div className="flex flex-col gap-3">
            <Select
              aria-label="Offre"
              options={PLANS}
              value={plan}
              onValueChange={setPlan}
              placeholder="Choisir une offre…"
            />
            <p className="text-xs text-muted-foreground">
              Valeur : <span className="font-mono">{String(plan)}</span>
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Accordion — single et multiple"
          description="Mode single : ouvrir une section ferme l'autre (résolu dans le reducer, pas dans React). Les en-têtes sont de vrais boutons : ↑ ↓ naviguent (wrap), Home/End sautent, et l'effet scrollToItem devient « focus ce bouton »."
        >
          <div className="flex flex-col gap-4">
            <Accordion
              mode="single"
              defaultExpandedKeys={["shipping"]}
              items={[
                {
                  key: "shipping",
                  title: "Livraison",
                  content: "Expédition sous 48 h. Mode single : ouvrir « Retours » me ferme.",
                },
                {
                  key: "returns",
                  title: "Retours",
                  content: "30 jours pour changer d'avis.",
                },
                {
                  key: "warranty",
                  title: "Garantie",
                  content: "2 ans constructeur.",
                },
              ]}
            />
            <Accordion
              mode="multiple"
              items={[
                { key: "a", title: "Multiple — section A", content: "Je reste ouverte…" },
                { key: "b", title: "Multiple — section B", content: "…même quand A l'est aussi." },
              ]}
            />
          </div>
        </Showcase>

        <Showcase
          title="ContextMenu — la machine Menu, déclenchée au pointeur"
          description="Clic droit n'importe où dans la zone : le menu s'ouvre à la position du curseur (ancre virtuelle 0×0 + positioning core, flip près des bords). Au clavier : Shift+F10. Échap ferme, ↑ ↓ naviguent, Entrée active."
        >
          <div className="flex flex-col gap-3">
            <ContextMenu
              sections={[
                {
                  label: "Fichier",
                  items: [
                    { key: "open", label: "Ouvrir", icon: <FolderOpen className="size-4" /> },
                    { key: "rename", label: "Renommer", icon: <Pencil className="size-4" /> },
                    { key: "share", label: "Partager", icon: <Share2 className="size-4" /> },
                  ],
                },
                {
                  items: [
                    {
                      key: "copy",
                      label: "Copier",
                      icon: <Copy className="size-4" />,
                      shortcut: "Mod+C",
                    },
                    {
                      key: "cut",
                      label: "Couper",
                      icon: <Scissors className="size-4" />,
                      shortcut: "Mod+X",
                    },
                    {
                      key: "delete",
                      label: "Supprimer",
                      icon: <Trash2 className="size-4" />,
                      destructive: true,
                    },
                  ],
                },
              ]}
              onAction={(key) => setLastAction(key)}
            >
              <div
                tabIndex={0}
                className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clic droit ici (ou Shift+F10 au clavier)
              </div>
            </ContextMenu>
            <p className="text-xs text-muted-foreground">
              Dernière action : <span className="font-mono">{lastAction ?? "aucune"}</span>
            </p>
          </div>
        </Showcase>
      </div>
    </div>
  );
}
