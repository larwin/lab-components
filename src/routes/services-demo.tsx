import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import type { Key } from "@/framework/core";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Listbox,
  Select,
  Spinner,
  Switch,
  TextField,
} from "@/framework/primitives";
import { ServicesProvider, useFacade, useStoreValue } from "@/framework/react/services";
import { MetricCard, PageHeader, Showcase } from "@/playground/components/primitives";

import { buildCampaignContainer } from "@/examples/campaign/container";
import type { ServiceBuilds } from "@/examples/campaign/facades";
import type { CampaignFormModel, CategoryId, TemplateId } from "@/examples/campaign/model";
import type { ValidationIssue } from "@/examples/campaign/services";
import {
  CampaignFacadeToken,
  CategoryStoreToken,
  ContactFacadeToken,
  FieldStoreToken,
  TemplateStoreToken,
} from "@/examples/campaign/tokens";

export const Route = createFileRoute("/services-demo")({
  head: () => ({
    meta: [
      { title: "Services & DI — Forge" },
      {
        name: "description",
        content:
          "Framework-agnostic business services, live stores and a foolproof invalidation graph — RFC-002, wired to the Forge primitives.",
      },
    ],
  }),
  component: ServicesDemoPage,
});

function ServicesDemoPage() {
  // The composition root: build the container once, dispose it on unmount.
  const [container] = useState(() => buildCampaignContainer());
  useEffect(() => () => container.dispose(), [container]);

  return (
    <ServicesProvider container={container}>
      <CampaignEditor />
    </ServicesProvider>
  );
}

function CampaignEditor() {
  // The two doors into the layer: facades (to act) and stores (to react).
  const campaign = useFacade(CampaignFacadeToken);
  const contact = useFacade(ContactFacadeToken);
  // One subscription to the whole snapshot — `s => s` is stable between changes.
  const categoryState = useStoreValue(CategoryStoreToken, (s) => s);
  const templates = useStoreValue(TemplateStoreToken, (s) => s.all);
  const fields = useStoreValue(FieldStoreToken, (s) => s.all);

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId | "">("");
  const [templateId, setTemplateId] = useState<TemplateId | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [saved, setSaved] = useState<{ dto: unknown; status: string } | null>(null);
  const [builds, setBuilds] = useState<ServiceBuilds>({ contact: 0, campaign: 0 });
  const [busy, setBusy] = useState(false);

  // Auto-refresh: two INDEPENDENT, staggered pollers simulating periodic fetches.
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [catPoll, setCatPoll] = useState<{ at: string; n: number }>({ at: "—", n: 0 });
  const [tplPoll, setTplPoll] = useState<{ at: string; n: number }>({ at: "—", n: 0 });
  const [busyCat, setBusyCat] = useState(false);
  const [busyTpl, setBusyTpl] = useState(false);

  const templateOptions = useMemo(
    () => templates.filter((t) => categoryId !== "" && t.categoryId === categoryId),
    [templates, categoryId],
  );

  const refreshBuilds = () => setBuilds(campaign.serviceBuilds());

  // Initial load from the mock API.
  useEffect(() => {
    let alive = true;
    setBusy(true);
    void Promise.all([
      campaign.reloadCategories(),
      campaign.reloadTemplates(),
      contact.reloadFields(),
    ]).then(() => {
      if (!alive) return;
      setBuilds(campaign.serviceBuilds());
      setBusy(false);
    });
    return () => {
      alive = false;
    };
  }, [campaign, contact]);

  // Two independent timers. Categories fire at 10s/20s/…, templates are offset by
  // 5s so the two lists visibly refresh at different moments — they share nothing.
  useEffect(() => {
    if (!autoRefresh) return;
    let alive = true;
    const stamp = () => new Date().toLocaleTimeString("fr-FR");

    const pollCategories = async () => {
      setBusyCat(true);
      await campaign.reloadCategories();
      if (!alive) return;
      setCatPoll((p) => ({ at: stamp(), n: p.n + 1 }));
      setBuilds(campaign.serviceBuilds()); // store changed → CampaignService rebuilds
      setBusyCat(false);
    };
    const pollTemplates = async () => {
      setBusyTpl(true);
      await campaign.reloadTemplates();
      if (!alive) return;
      setTplPoll((p) => ({ at: stamp(), n: p.n + 1 }));
      setBuilds(campaign.serviceBuilds());
      setBusyTpl(false);
    };

    const catTimer = setInterval(() => void pollCategories(), 10_000);
    let tplTimer: ReturnType<typeof setInterval> | undefined;
    const tplKickoff = setTimeout(() => {
      void pollTemplates();
      tplTimer = setInterval(() => void pollTemplates(), 10_000);
    }, 5_000);

    return () => {
      alive = false;
      clearInterval(catTimer);
      clearTimeout(tplKickoff);
      if (tplTimer) clearInterval(tplTimer);
    };
  }, [autoRefresh, campaign]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    await action();
    refreshBuilds();
    setBusy(false);
  };

  const model: CampaignFormModel = { name, categoryId, templateId, customValues };

  const handleSubmit = async () => {
    const result = campaign.validate(model);
    setIssues(result.issues);
    if (!result.ok) {
      setSaved(null);
      refreshBuilds();
      return;
    }
    setBusy(true);
    const { campaign: persisted, dto } = await campaign.save(model);
    setSaved({ dto, status: persisted.status });
    refreshBuilds();
    setBusy(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Architecture · RFC-002"
        title="Services & dependency injection"
        description={
          <>
            Toute la logique métier de cet écran vit dans des services TypeScript purs, sans React,
            testés en Node. Le formulaire ne parle qu&apos;à des <strong>façades</strong> (agir) et
            à des <strong>stores</strong> observables (réagir). Les services sont reconstruits
            <em> automatiquement et une seule fois </em> quand une dépendance change — les compteurs
            le prouvent en direct.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        <MetricCard
          label="Catégories actives"
          value={categoryState.active.length}
          unit="store live"
        />
        <MetricCard label="Templates" value={templates.length} unit="store live" />
        <MetricCard label="Champs custom" value={fields.length} unit="store live" />
        <MetricCard label="ContactService" value={builds.contact} unit="builds" accent />
        <MetricCard label="CampaignService" value={builds.campaign} unit="builds" accent />
      </div>

      <div className="mb-6">
        <Showcase
          title="Données vivantes en temps réel — rafraîchissement auto (10 s)"
          description="Deux stores INDÉPENDANTS rechargés par un faux appel sur des minuteurs séparés (catégories à 10/20/30 s, templates décalés de 5 s). Les listes changent toutes seules, sans clic. Comme CampaignService dépend de ces stores, son compteur de builds grimpe en même temps, tandis que ContactService (qui n'en dépend pas) reste figé — l'invalidation chirurgicale, mains libres."
        >
          <div className="flex flex-col gap-4">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh}>
              Rafraîchissement automatique {autoRefresh ? "activé" : "en pause"}
            </Switch>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Catégories</span>
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    {busyCat && <Spinner size="sm" label="Rechargement des catégories…" />}
                    appel #{catPoll.n} · {catPoll.at}
                  </span>
                </div>
                <Listbox
                  aria-label="Catégories"
                  selectionMode="none"
                  items={categoryState.all}
                  getKey={(category) => category.id as Key}
                  getTextValue={(category) => category.name}
                  renderItem={({ node }) => (
                    <span className="flex w-full items-center justify-between">
                      <span>{node.value.name}</span>
                      <Badge variant={node.value.archived ? "outline" : "success"}>
                        {node.value.archived ? "archivée" : "active"}
                      </Badge>
                    </span>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Templates</span>
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    {busyTpl && <Spinner size="sm" label="Rechargement des templates…" />}
                    appel #{tplPoll.n} · {tplPoll.at}
                  </span>
                </div>
                <Listbox
                  aria-label="Templates"
                  selectionMode="none"
                  items={templates}
                  getKey={(template) => template.id as Key}
                  getTextValue={(template) => template.name}
                  renderItem={({ node }) => (
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>{node.value.name}</span>
                      <Badge variant="outline">
                        {categoryState.byId.get(node.value.categoryId)?.name ??
                          node.value.categoryId}
                      </Badge>
                    </span>
                  )}
                />
              </div>
            </div>
          </div>
        </Showcase>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="Données vivantes (API mockée, qui varie)"
          description="Chaque action appelle un faux backend (latence ~350 ms), met à jour un store observable, et invalide les services qui en dépendent. Observez les compteurs ci-dessus."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onPress={() => void run(() => campaign.reloadCategories())}>
                Recharger les catégories
              </Button>
              <Button onPress={() => void run(() => campaign.reloadTemplates())}>
                Recharger les templates
              </Button>
              <Button variant="primary" onPress={() => void run(() => contact.addCustomField())}>
                Ajouter un champ requis
              </Button>
              {busy && <Spinner size="sm" label="Appel en cours…" />}
            </div>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              <li>
                <span className="font-mono text-foreground">Recharger catégories / templates</span>{" "}
                → seul <Badge variant="outline">CampaignService</Badge> se reconstruit.
              </li>
              <li>
                <span className="font-mono text-foreground">Ajouter un champ requis</span> → les{" "}
                <Badge variant="outline">deux</Badge> se reconstruisent (CampaignService dépend de
                ContactService).
              </li>
            </ul>
          </div>
        </Showcase>

        <Showcase
          title="Formulaire campagne"
          description="Modèle interne (name/categoryId), jamais le DTO backend. La validation est déléguée à CampaignService, qui délègue les champs custom à ContactService."
        >
          <div className="flex flex-col gap-4">
            <TextField
              label="Nom de la campagne"
              description="3 caractères minimum (règle portée par le service)."
              value={name}
              onValueChange={setName}
            />

            <Field label="Catégorie">
              <Select
                aria-label="Catégorie"
                placeholder="Choisir une catégorie…"
                options={categoryState.active.map((c) => ({ key: c.id as Key, label: c.name }))}
                value={categoryId === "" ? null : (categoryId as Key)}
                onValueChange={(value) => {
                  setCategoryId((value ?? "") as CategoryId | "");
                  setTemplateId(null);
                }}
              />
            </Field>

            <Field
              label="Template"
              description={
                categoryId === ""
                  ? "Choisissez d'abord une catégorie."
                  : `${templateOptions.length} template(s) dans cette catégorie.`
              }
            >
              <Select
                aria-label="Template"
                placeholder="Choisir un template…"
                disabled={categoryId === ""}
                options={templateOptions.map((t) => ({ key: t.id as Key, label: t.name }))}
                value={templateId as Key | null}
                onValueChange={(value) => setTemplateId((value as TemplateId | null) ?? null)}
              />
            </Field>

            {fields.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Champs custom (définis par FieldStore, validés par ContactService)
                </p>
                {fields.map((field) => (
                  <TextField
                    key={field.id}
                    label={`${field.label}${field.required ? " *" : ""}`}
                    type={field.type === "email" ? "email" : "text"}
                    value={customValues[field.key] ?? ""}
                    onValueChange={(value) =>
                      setCustomValues((current) => ({ ...current, [field.key]: value }))
                    }
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button variant="primary" onPress={() => void handleSubmit()}>
                Valider & enregistrer
              </Button>
            </div>

            {issues.length > 0 && (
              <Alert kind="error" title="Validation échouée">
                <ul className="ml-4 list-disc">
                  {issues.map((issue) => (
                    <li key={issue.field}>{issue.message}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>
        </Showcase>
      </div>

      {saved && (
        <div className="mt-6">
          <Card
            title="Enregistré (POST mocké)"
            description="Le service a validé, puis le mapper a transformé le modèle interne en DTO backend (snake_case). C'est ce DTO qui part sur le réseau — jamais le modèle du formulaire."
            headerExtra={<Badge variant="success">{saved.status}</Badge>}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Modèle interne (formulaire)
                </p>
                <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(model, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  DTO backend (réseau)
                </p>
                <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(saved.dto, null, 2)}
                </pre>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
