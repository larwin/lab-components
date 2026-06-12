import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  PinInput,
  Rating,
  SearchField,
  TagsInput,
  TextArea,
  ToastProvider,
  useToast,
} from "@/framework/primitives";
import { MetricCard, PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/inputs-advanced")({
  head: () => ({
    meta: [
      { title: "Saisie avancée — Forge" },
      {
        name: "description",
        content: "TextArea, SearchField, TagsInput, Rating, PinInput — machines pures.",
      },
    ],
  }),
  component: () => (
    <ToastProvider maxToasts={3}>
      <InputsAdvancedPage />
    </ToastProvider>
  ),
});

const SKILLS = [
  "TypeScript",
  "React",
  "Vue",
  "Svelte",
  "Node.js",
  "Rust",
  "Go",
  "Python",
  "Kubernetes",
  "Terraform",
  "PostgreSQL",
  "Redis",
];

function InputsAdvancedPage() {
  const { toast } = useToast();
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState<string[]>(["typescript", "react"]);
  const [rating, setRating] = useState(3.5);
  const [lastSearch, setLastSearch] = useState<string | null>(null);
  const [pinResult, setPinResult] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Saisie avancée"
        description={
          <>
            Vague 4 : la requête du SearchField vit <em>dans la machine</em> (Escape la vide par
            binding déclaratif, qui laisse passer la touche quand le champ est vide) ; le TagsInput
            fait coopérer deux machines pures — le ComboBox en mode multiple et un Navigable
            horizontal sur les chips avec un nœud sentinelle pour l&apos;input ; le PinInput est une
            machine dédiée (curseur de segment, paste réparti) ; le Rating réutilise NumericValue
            tel quel — zéro nouveau behavior.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Tests Node ajoutés" value="39" unit="machines, zéro DOM" accent />
        <MetricCard label="Nouveaux behaviors" value="0" unit="compositions seulement" />
        <MetricCard label="Machine dédiée" value="1" unit="PinInput (createMachine)" />
        <MetricCard label="Machines TagsInput" value="2" unit="picker + rangée de chips" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="SearchField — Escape déclaratif, Enter = search"
          description="Tapez puis Escape : le binding vide la requête (intent search/clear). Champ déjà vide : le binding retourne null et Escape traverse. Enter émet l'événement search."
        >
          <div className="flex flex-col gap-3">
            <SearchField
              aria-label="Rechercher dans la documentation"
              placeholder="Rechercher… (Enter lance, Escape vide)"
              onSearch={(q) => setLastSearch(q)}
            />
            <p className="font-mono text-xs text-muted-foreground">
              Dernière recherche : {lastSearch === null ? "—" : `« ${lastSearch} »`}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Rating — NumericValue rendu en étoiles"
          description="Flèches (les deux axes), Home/End → 0/5, clic (moitié gauche = demi-étoile), re-clic sur la valeur = remise à zéro. aria-valuetext annonce « 3.5 étoiles sur 5 »."
        >
          <div className="flex items-center gap-4">
            <Rating
              aria-label="Note du produit"
              step={0.5}
              value={rating}
              onValueChange={setRating}
            />
            <span className="font-mono text-sm text-muted-foreground tabular-nums">
              {rating} / 5
            </span>
          </div>
        </Showcase>

        <Showcase
          title="TagsInput — deux machines, chips au clavier"
          description="Choisissez des options (la liste reste ouverte, Enter coche/décoche). Backspace sur champ vide focalise le dernier chip, ← → naviguent, Backspace retire et focalise le voisin, → depuis le dernier chip revient à l'input."
        >
          <div className="flex flex-col gap-3">
            <TagsInput
              aria-label="Compétences"
              items={SKILLS}
              getKey={(s) => s.toLowerCase()}
              getTextValue={(s) => s}
              value={tags}
              onValueChange={(keys) => setTags(keys)}
              placeholder="Ajouter une compétence…"
            />
            <p className="font-mono text-xs text-muted-foreground">
              value = [{tags.map((t) => `"${t}"`).join(", ")}]
            </p>
          </div>
        </Showcase>

        <Showcase
          title="PinInput — paste réparti, auto-complétion"
          description="Tapez un code à 6 chiffres ou collez « 12-34 56 » n'importe où : la machine sanitise et répartit depuis le segment actif. Backspace recule, Home/End sautent. La complétion déclenche un toast."
        >
          <div className="flex flex-col gap-3">
            <PinInput
              aria-label="Code de vérification"
              length={6}
              onComplete={(v) => {
                setPinResult(v);
                toast({ kind: "success", title: "Code complet", description: `Reçu : ${v}` });
              }}
            />
            <p className="font-mono text-xs text-muted-foreground">
              Dernier code complet : {pinResult ?? "—"}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="TextArea — auto-resize + compteur câblé à maxLength"
          description="Le champ grandit avec le contenu (3 → 8 lignes). Approchez la limite de 120 caractères : le compteur passe en avertissement et le lecteur d'écran reçoit « N caractères restants » (une seule fois, à l'entrée dans la fenêtre)."
          className="lg:col-span-2"
        >
          <TextArea
            label="Biographie"
            description="120 caractères maximum."
            value={bio}
            onValueChange={setBio}
            maxLength={120}
            autoResize
            maxRows={8}
            placeholder="Parlez de vous…"
            validate={(v) => (v.includes("@") ? "Pas d'adresse e-mail dans la bio" : null)}
            className="max-w-xl"
          />
        </Showcase>
      </div>
    </div>
  );
}
