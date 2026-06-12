import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Carousel, type CarouselSlideDef } from "@/framework/primitives";
import { MetricCard, PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/carousel")({
  head: () => ({
    meta: [
      { title: "Carousel — Forge" },
      {
        name: "description",
        content: "Carrousel : drag-snap, autoplay pausable, boucle infinie, virtualisation.",
      },
    ],
  }),
  component: CarouselPage,
});

/** Generated "photo" slides — gradients, zero network. */
const photoSlide = (i: number, total: number, height = "h-56"): CarouselSlideDef => ({
  key: `photo-${i}`,
  label: `Photo ${i + 1}`,
  content: (
    <div
      className={`flex ${height} w-full items-end justify-between rounded-lg p-4 text-white`}
      style={{
        background: `linear-gradient(135deg, hsl(${(i * 47) % 360} 70% 45%), hsl(${(i * 47 + 60) % 360} 80% 30%))`,
      }}
    >
      <span className="text-2xl font-bold drop-shadow">{i + 1}</span>
      <span className="font-mono text-xs opacity-80">
        {i + 1} / {total}
      </span>
    </div>
  ),
});

function CarouselPage() {
  const [galleryPage, setGalleryPage] = useState(0);
  const [loopPage, setLoopPage] = useState(0);
  const [mounted10k, setMounted10k] = useState(0);
  const [bigPage, setBigPage] = useState(0);

  const gallery = useMemo(() => Array.from({ length: 8 }, (_, i) => photoSlide(i, 8)), []);
  const loopCards = useMemo(
    () => Array.from({ length: 9 }, (_, i) => photoSlide(i, 9, "h-36")),
    [],
  );
  const big = useMemo(
    () => Array.from({ length: 10_000 }, (_, i) => photoSlide(i, 10_000, "h-40")),
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Carousel"
        description={
          <>
            Vague 9b : zéro machine nouvelle pour la piste — [Focusable + Navigable(horizontal) +
            Autoplayable] sur une collection de pages (focus logique aria-activedescendant : les
            pages non montées existent pour le clavier, wrap = boucle). Le drag-snap réutilise la
            géométrie de roue de la 8b (<code>wheelSettle</code> à l&apos;horizontale), la boucle
            infinie est un modulo pur (pas de clonage DOM), et l&apos;autoplay suit le pattern
            timers du Toast : <code>schedule-advance</code>/<code>cancel-advance</code> — chaque
            chemin qui arrête émet son cancel.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Galerie — page" value={`${galleryPage + 1} / 8`} />
        <MetricCard label="Boucle — page" value={`${loopPage + 1} / 3`} />
        <MetricCard label="Galerie 10k — slides montées" value={mounted10k} accent />
        <MetricCard label="Galerie 10k — page" value={`${bigPage + 1} / 10000`} />
      </div>

      <div className="space-y-8">
        <Showcase
          title="Galerie autoplay : drag, flèches, points, rotation pausable"
          description={
            <>
              Faites glisser (l&apos;inertie v²/2a fait défiler plusieurs pages, puis snap), flèches
              ←/→ au clavier (Home/End aussi), points = un ToggleGroup (composition). La rotation se
              suspend au survol, au focus ET quand l&apos;onglet est masqué — bouton lecture/pause
              obligatoire (APG) en tête de tab order. Les annonces lecteur d&apos;écran « Page i sur
              n » ne partent que rotation arrêtée (APG).
            </>
          }
        >
          <Carousel
            slides={gallery}
            autoplay
            autoplayInterval={3000}
            loop
            onIndexChange={setGalleryPage}
            aria-label="Galerie de photos"
            className="max-w-xl"
          />
        </Showcase>

        <Showcase
          title="3 slides par page, boucle infinie"
          description={
            <>
              9 slides, 3 par page → 3 pages en boucle : la normalisation d&apos;index est le modulo
              pur <code>normalizeLoopIndex</code> et le franchissement de la couture anime vers
              l&apos;avant (<code>loopDelta</code> choisit le plus court chemin signé) — pas de
              clones DOM, les mêmes nœuds se repositionnent.
            </>
          }
        >
          <Carousel
            slides={loopCards}
            slidesPerPage={3}
            loop
            onIndexChange={setLoopPage}
            aria-label="Cartes en boucle"
            className="max-w-2xl"
          />
        </Showcase>

        <Showcase
          title="10 000 slides : la piste est virtualisée"
          description={
            <>
              Le compteur ci-dessus prouve la fenêtre de montage : seules les pages voisines de la
              position courante existent dans le DOM (virtualizer Fenwick — le même que la grille
              500k). Tapez End pour sauter à la page 10000 : le focus logique n&apos;a pas besoin
              que la page soit montée.
            </>
          }
        >
          <Carousel
            slides={big}
            loop={false}
            showDots={false}
            overscan={1}
            onIndexChange={setBigPage}
            onMountedSlidesChange={setMounted10k}
            aria-label="Galerie de dix mille images"
            className="max-w-xl"
          />
        </Showcase>
      </div>
    </div>
  );
}
