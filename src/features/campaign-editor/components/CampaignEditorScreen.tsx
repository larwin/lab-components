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
import { MetricCard, PageHeader, Showcase } from "@/components/primitives";

import { buildWebApplication } from "@/WebApplication";
import {
  CategoryFacadeToken,
  CategoryStoreToken,
  type CategoryId,
} from "@/domains/business/campaign/categories";
import {
  FieldFacadeToken,
  FieldStoreToken,
  type ValidationIssue,
} from "@/domains/business/data-management/fields";
import {
  TemplateFacadeToken,
  TemplateStoreToken,
  type TemplateId,
} from "@/domains/business/campaign/templates";

import { CampaignEditorFacadeToken, type ServiceBuilds } from "../index";
import { useCampaignEditorStore } from "../hooks/useCampaignEditorStore";

/**
 * Composition root for the campaign-editor application. Builds the scope tree
 * once (App → Account), provides the CURRENT ACCOUNT node to the tree below, and
 * disposes the whole tree on unmount. Components below see only facades + stores.
 */
export function CampaignEditorScreen() {
  const [tree] = useState(() => buildWebApplication());
  useEffect(() => () => tree.app.dispose(), [tree]);

  return (
    <ServicesProvider container={tree.account}>
      <CampaignEditorBody />
    </ServicesProvider>
  );
}

function CampaignEditorBody() {
  // Facades to act, stores to react — the only two doors into the container.
  const editor = useFacade(CampaignEditorFacadeToken);
  const categoryFacade = useFacade(CategoryFacadeToken);
  const templateFacade = useFacade(TemplateFacadeToken);
  const fieldFacade = useFacade(FieldFacadeToken);
  const categoryState = useStoreValue(CategoryStoreToken, (s) => s);
  const templates = useStoreValue(TemplateStoreToken, (s) => s.all);
  const fields = useStoreValue(FieldStoreToken, (s) => s.all);

  // The screen's draft lives in a UI STORE (out of the container, per-component).
  const { draft, actions } = useCampaignEditorStore();

  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [saved, setSaved] = useState<{ dto: unknown; status: string } | null>(null);
  const [builds, setBuilds] = useState<ServiceBuilds>({ field: 0, editor: 0 });
  const [busy, setBusy] = useState(false);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [catPoll, setCatPoll] = useState<{ at: string; n: number }>({ at: "—", n: 0 });
  const [tplPoll, setTplPoll] = useState<{ at: string; n: number }>({ at: "—", n: 0 });
  const [busyCat, setBusyCat] = useState(false);
  const [busyTpl, setBusyTpl] = useState(false);

  const templateOptions = useMemo(
    () => templates.filter((t) => draft.categoryId !== "" && t.categoryId === draft.categoryId),
    [templates, draft.categoryId],
  );

  const refreshBuilds = () => setBuilds(editor.serviceBuilds());

  // Initial load from the mock API.
  useEffect(() => {
    let alive = true;
    setBusy(true);
    void Promise.all([categoryFacade.reload(), templateFacade.reload(), fieldFacade.reload()]).then(
      () => {
        if (!alive) return;
        setBuilds(editor.serviceBuilds());
        setBusy(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [editor, categoryFacade, templateFacade, fieldFacade]);

  // Two independent timers — categories at 10/20/…s, templates offset by 5s.
  useEffect(() => {
    if (!autoRefresh) return;
    let alive = true;
    const stamp = () => new Date().toLocaleTimeString("fr-FR");

    const pollCategories = async () => {
      setBusyCat(true);
      await categoryFacade.reload();
      if (!alive) return;
      setCatPoll((p) => ({ at: stamp(), n: p.n + 1 }));
      setBuilds(editor.serviceBuilds());
      setBusyCat(false);
    };
    const pollTemplates = async () => {
      setBusyTpl(true);
      await templateFacade.reload();
      if (!alive) return;
      setTplPoll((p) => ({ at: stamp(), n: p.n + 1 }));
      setBuilds(editor.serviceBuilds());
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
  }, [autoRefresh, editor, categoryFacade, templateFacade]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    await action();
    refreshBuilds();
    setBusy(false);
  };

  const handleSubmit = async () => {
    const result = editor.validate(draft);
    setIssues(result.issues);
    if (!result.ok) {
      setSaved(null);
      refreshBuilds();
      return;
    }
    setBusy(true);
    const { campaign, dto } = await editor.save(draft);
    setSaved({ dto, status: campaign.status });
    refreshBuilds();
    setBusy(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Architecture · RFC-003"
        title="Campaign editor — domains, application & composite scopes"
        description={
          <>
            Toute la logique métier vit dans des <strong>domaines</strong> purs (categories,
            templates, fields) montés au niveau <strong>compte</strong> ; l&apos;orchestration
            cross-domaine est une <strong>application</strong>. Le formulaire est un{" "}
            <strong>UI store</strong> hors conteneur. Les compteurs prouvent l&apos;invalidation —
            reconstruction <em>automatique et unique</em>.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        <MetricCard label="Catégories actives" value={categoryState.active.length} unit="store" />
        <MetricCard label="Templates" value={templates.length} unit="store" />
        <MetricCard label="Champs custom" value={fields.length} unit="store" />
        <MetricCard label="FieldService" value={builds.field} unit="builds" accent />
        <MetricCard label="CampaignEditorService" value={builds.editor} unit="builds" accent />
      </div>

      <div className="mb-6">
        <Showcase
          title="Données vivantes — rafraîchissement auto (10 s)"
          description="Deux stores de domaine INDÉPENDANTS rechargés sur des minuteurs séparés. Comme l'application dépend de ces stores, son compteur grimpe ; FieldService (qui n'en dépend pas) reste figé — invalidation chirurgicale, mains libres."
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
          description="Chaque action appelle un faux backend via un provider (fetch+parse+map), met à jour un store de domaine, et invalide les services qui en dépendent."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onPress={() => void run(() => categoryFacade.reload())}>
                Recharger les catégories
              </Button>
              <Button onPress={() => void run(() => templateFacade.reload())}>
                Recharger les templates
              </Button>
              <Button
                variant="primary"
                onPress={() => void run(() => fieldFacade.addCustomField())}
              >
                Ajouter un champ requis
              </Button>
              {busy && <Spinner size="sm" label="Appel en cours…" />}
            </div>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              <li>
                <span className="font-mono text-foreground">Recharger catégories / templates</span>{" "}
                → seul <Badge variant="outline">CampaignEditorService</Badge> se reconstruit.
              </li>
              <li>
                <span className="font-mono text-foreground">Ajouter un champ requis</span> → les{" "}
                <Badge variant="outline">deux</Badge> se reconstruisent (l&apos;app injecte
                FieldService).
              </li>
            </ul>
          </div>
        </Showcase>

        <Showcase
          title="Formulaire campagne (UI store)"
          description="Le brouillon est un UI store observable hors conteneur. La validation est déléguée à l'application, qui délègue les champs custom au domaine fields."
        >
          <div className="flex flex-col gap-4">
            <TextField
              label="Nom de la campagne"
              description="3 caractères minimum (règle portée par le service)."
              value={draft.name}
              onValueChange={actions.setName}
            />

            <Field label="Catégorie">
              <Select
                aria-label="Catégorie"
                placeholder="Choisir une catégorie…"
                options={categoryState.active.map((c) => ({ key: c.id as Key, label: c.name }))}
                value={draft.categoryId === "" ? null : (draft.categoryId as Key)}
                onValueChange={(value) => actions.setCategory((value ?? "") as CategoryId | "")}
              />
            </Field>

            <Field
              label="Template"
              description={
                draft.categoryId === ""
                  ? "Choisissez d'abord une catégorie."
                  : `${templateOptions.length} template(s) dans cette catégorie.`
              }
            >
              <Select
                aria-label="Template"
                placeholder="Choisir un template…"
                disabled={draft.categoryId === ""}
                options={templateOptions.map((t) => ({ key: t.id as Key, label: t.name }))}
                value={draft.templateId as Key | null}
                onValueChange={(value) => actions.setTemplate((value as TemplateId | null) ?? null)}
              />
            </Field>

            {fields.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Champs custom (définis par FieldStore, validés par FieldService)
                </p>
                {fields.map((field) => (
                  <TextField
                    key={field.id}
                    label={`${field.label}${field.required ? " *" : ""}`}
                    type={field.type === "email" ? "email" : "text"}
                    value={draft.customValues[field.key] ?? ""}
                    onValueChange={(value) => actions.setCustomValue(field.key, value)}
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
            description="L'application a validé, puis le mapper du domaine campaigns a transformé le brouillon en DTO backend (snake_case). C'est ce DTO qui part — jamais le modèle du formulaire."
            headerExtra={<Badge variant="success">{saved.status}</Badge>}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Brouillon (UI store)
                </p>
                <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(draft, null, 2)}
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
