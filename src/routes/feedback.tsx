import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button, Meter, Progress, Slider, ToastProvider, useToast } from "@/framework/primitives";
import { MetricCard, PageHeader, Showcase } from "@/components/primitives";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback — Forge" },
      {
        name: "description",
        content: "Toast queue machine, Progress and Meter with correct ARIA.",
      },
    ],
  }),
  component: () => (
    <ToastProvider maxToasts={4}>
      <FeedbackPage />
    </ToastProvider>
  ),
});

function FeedbackPage() {
  const { toast, clear } = useToast();
  const [upload, setUpload] = useState<number | null>(null);
  const [disk, setDisk] = useState(62);
  const uploadTimer = useRef<number | null>(null);

  // Simulated upload for the determinate progress demo.
  useEffect(() => {
    if (upload === null) return;
    if (upload >= 100) {
      toast({ kind: "success", title: "Envoi terminé", description: "report.pdf — 4,2 Mo" });
      setUpload(null);
      return;
    }
    uploadTimer.current = window.setTimeout(() => setUpload((u) => (u ?? 0) + 7), 180);
    return () => {
      if (uploadTimer.current) window.clearTimeout(uploadTimer.current);
    };
  }, [upload, toast]);

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Feedback"
        description={
          <>
            La file de toasts est une machine pure : le reducer décide des évictions et émet des
            effets déclaratifs — annonce lecteur d&apos;écran (assertive pour les erreurs) et timers
            (le setTimeout vit dans l&apos;adaptateur, le core n&apos;a pas d&apos;horloge).
            Progress et Meter sont purement présentationnels avec l&apos;ARIA natif correct.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Machine Toast" value="6" unit="tests Node, zéro DOM" accent />
        <MetricCard label="Horloge dans le core" value="0" unit="timers = effets" />
        <MetricCard label="File plafonnée" value="4" unit="toasts max (éviction)" />
        <MetricCard label="Annonces SR" value="2" unit="politeness selon kind" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="Toast — file, timers injectés, annonces"
          description="Chaque bouton enfile un toast (auto-fermeture 5 s, annulée au clic sur ×). Spammez « Info » : au-delà de 4, le reducer évicte le plus ancien ET annule son timer. L'erreur est sticky (duration null) et annoncée en assertif."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button onPress={() => toast({ title: "Nouvelle version disponible" })}>Info</Button>
            <Button
              onPress={() =>
                toast({
                  kind: "success",
                  title: "Enregistré",
                  description: "Vos modifications sont en ligne.",
                })
              }
            >
              Succès
            </Button>
            <Button
              onPress={() =>
                toast({
                  kind: "warning",
                  title: "Quota bientôt atteint",
                  description: "92 % de l'espace utilisé.",
                })
              }
            >
              Avertissement
            </Button>
            <Button
              variant="destructive"
              onPress={() =>
                toast({
                  kind: "error",
                  title: "Échec de la synchronisation",
                  description: "Sticky : fermez-moi à la main.",
                  duration: null,
                })
              }
            >
              Erreur (sticky)
            </Button>
            <Button onPress={clear}>Tout fermer</Button>
          </div>
        </Showcase>

        <Showcase
          title="Progress — déterminé et indéterminé"
          description="role=progressbar : aria-valuenow seulement en mode déterminé ; l'indéterminé n'expose pas de valeur (pattern natif). La fin de l'upload simulé enfile un toast succès."
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-end gap-3">
              <Progress label="Envoi de report.pdf" value={upload ?? 0} />
              <Button onPress={() => setUpload(0)} disabled={upload !== null}>
                {upload !== null ? `${upload} %` : "Démarrer"}
              </Button>
            </div>
            <Progress label="Indexation en cours…" aria-label="Indexation" />
          </div>
        </Showcase>

        <Showcase
          title="Meter — zones low/high/optimum"
          description="role=meter (une mesure, pas une progression) : optimum bas = « moins c'est mieux ». Glissez le slider : vert ≤ 70, orange ≤ 90, rouge au-delà — la sémantique du <meter> natif."
          className="lg:col-span-2"
        >
          <div className="flex flex-col gap-4">
            <Slider
              aria-label="Simuler l'occupation disque"
              min={0}
              max={100}
              value={disk}
              onValueChange={setDisk}
              formatValue={(v) => `${v} %`}
            />
            <div className="flex flex-wrap gap-8">
              <Meter
                label="Disque"
                value={disk}
                low={70}
                high={90}
                optimum={0}
                formatValue={(v) => `${v} % utilisés`}
                className="flex-1"
              />
              <Meter
                label="Batterie"
                value={100 - disk}
                low={20}
                high={50}
                optimum={100}
                formatValue={(v) => `${v} %`}
                className="flex-1"
              />
            </div>
          </div>
        </Showcase>
      </div>
    </div>
  );
}
