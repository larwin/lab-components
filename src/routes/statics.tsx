import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FolderOpen, Inbox } from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Dropzone,
  EmptyState,
  Separator,
  Skeleton,
  Spinner,
} from "@/framework/primitives";
import { MetricCard, PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/statics")({
  head: () => ({
    meta: [
      { title: "Statiques — Forge" },
      {
        name: "description",
        content: "Alert, Badge, Avatar, Card, Separator, Skeleton, Spinner, EmptyState, Dropzone.",
      },
    ],
  }),
  component: StaticsPage,
});

function StaticsPage() {
  const [dropLog, setDropLog] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Statiques & finitions"
        description={
          <>
            Vague 6 — volontairement <em>sans machine</em> : pour des composants statiques, un rôle
            ARIA correct et les tokens du thème suffisent (pas de sur-ingénierie). Seule la Dropzone
            embarque de la logique : sa politique d&apos;acceptation (extensions/mime/taille/nombre)
            est une fonction pure testée en Node, et le verdict est annoncé aux lecteurs
            d&apos;écran via la live region partagée.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Composants" value="9" unit="statiques, zéro machine" accent />
        <MetricCard label="Politique pure" value="1" unit="partitionFiles (Node)" />
        <MetricCard label="Variantes CVA" value="3" unit="Alert, Badge, Spinner" />
        <MetricCard label="Tokens codés en dur" value="0" unit="thème uniquement" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="Alert — role selon la gravité"
          description="info/success portent role=status (annonce polie), warning/error portent role=alert (annonce immédiate à l'apparition)."
        >
          <div className="flex flex-col gap-3">
            <Alert kind="info" title="Nouvelle version disponible">
              Forge 0.7 ajoute les vagues 4 à 6.
            </Alert>
            <Alert kind="success" title="Build vert" />
            <Alert kind="warning" title="Quota presque atteint">
              92 % de l&apos;espace utilisé.
            </Alert>
            <Alert kind="error" title="Synchronisation échouée">
              Le serveur n&apos;a pas répondu. Réessayez.
            </Alert>
          </div>
        </Showcase>

        <Showcase
          title="Badge, Avatar, Separator, Spinner"
          description="Badge : variantes CVA sur tokens. Avatar : image avec repli initiales automatique (la 2ᵉ src est cassée). Spinner : role=status + libellé sr-only."
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>défaut</Badge>
              <Badge variant="primary">primary</Badge>
              <Badge variant="outline">outline</Badge>
              <Badge variant="success">stable</Badge>
              <Badge variant="warning">beta</Badge>
              <Badge variant="destructive">deprecated</Badge>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Avatar name="Ada Lovelace" src="https://i.pravatar.cc/64?img=5" />
              <Avatar name="Grace Hopper" src="/img-cassee.jpg" />
              <Avatar name="Forge" size="lg" />
              <Avatar name="Nicolas Retoret" size="sm" />
              <Separator orientation="vertical" className="h-8" />
              <Spinner size="sm" />
              <Spinner />
              <Spinner size="lg" label="Synchronisation en cours…" />
            </div>
          </div>
        </Showcase>

        <Showcase
          title="Card + Skeleton — chargement"
          description="La carte de gauche est chargée ; celle de droite est son squelette (aria-hidden : l'état de chargement appartient à la surface, pas aux os)."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              title="Rapport hebdomadaire"
              description="Généré il y a 2 h"
              headerExtra={<Badge variant="success">prêt</Badge>}
              footer={<Button>Télécharger</Button>}
            >
              <p className="text-muted-foreground">
                249 tests verts, 0 erreur lint, 3 vagues livrées.
              </p>
            </Card>
            <Card>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-2.5 w-5/6" />
                <Skeleton className="h-8 w-28 self-end rounded-md" />
              </div>
            </Card>
          </div>
        </Showcase>

        <Showcase
          title="EmptyState"
          description="« Rien ici » avec appel à l'action — l'icône est décorative, le message porte le sens."
        >
          <EmptyState
            icon={<Inbox />}
            title="Aucune notification"
            description="Les alertes de vos projets apparaîtront ici dès qu'il se passera quelque chose."
            action={<Button variant="primary">Configurer les alertes</Button>}
          />
        </Showcase>

        <Showcase
          title="Dropzone — politique pure + annonces SR"
          description="Accepte images et PDF, 1 Mo max, 3 fichiers max. Déposez un lot mélangé : partitionFiles (testé en Node) trie et le verdict est annoncé (assertif s'il y a des refus)."
          className="lg:col-span-2"
        >
          <div className="flex flex-col gap-3">
            <Dropzone
              accept="image/*,.pdf"
              maxSize={1024 * 1024}
              maxFiles={3}
              label="Déposez images ou PDF"
              hint="1 Mo max par fichier, 3 fichiers max — ou cliquez"
              onFiles={(accepted, rejected) =>
                setDropLog(
                  `${accepted.length} accepté(s) [${accepted.map((f) => f.name).join(", ")}] · ` +
                    `${rejected.length} refusé(s) [${rejected
                      .map((r) => `${r.file.name}: ${r.reason}`)
                      .join(", ")}]`,
                )
              }
            />
            <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <FolderOpen className="size-3.5" />
              {dropLog ?? "—"}
            </p>
          </div>
        </Showcase>
      </div>
    </div>
  );
}
