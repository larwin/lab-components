import { useMemo, useRef, useSyncExternalStore } from "react";

import type { CategoryId } from "@/domains/business/campaign/categories";
import type { TemplateId } from "@/domains/business/campaign/templates";

import {
  createCampaignEditorStore,
  editorIntents,
  type CampaignEditorState,
} from "../stores/campaignEditor.store";

export interface CampaignEditorActions {
  setName(name: string): void;
  setCategory(categoryId: CategoryId | ""): void;
  setTemplate(templateId: TemplateId | null): void;
  setCustomValue(key: string, value: string): void;
  reset(): void;
}

/**
 * React binding for the UI store. The store is created PER COMPONENT (instance-
 * per-mount) and lives outside the container — two open editors are isolated,
 * each torn down with its component. Pure logic stays in the core Store; only
 * this binding (useSyncExternalStore) is framework-specific.
 */
export function useCampaignEditorStore(): {
  draft: CampaignEditorState;
  actions: CampaignEditorActions;
} {
  const ref = useRef<ReturnType<typeof createCampaignEditorStore> | null>(null);
  if (ref.current === null) ref.current = createCampaignEditorStore();
  const store = ref.current;

  const draft = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  const actions = useMemo<CampaignEditorActions>(
    () => ({
      setName: (name) => store.dispatch(editorIntents.setName({ name })),
      setCategory: (categoryId) => store.dispatch(editorIntents.setCategory({ categoryId })),
      setTemplate: (templateId) => store.dispatch(editorIntents.setTemplate({ templateId })),
      setCustomValue: (key, value) => store.dispatch(editorIntents.setCustomValue({ key, value })),
      reset: () => store.dispatch(editorIntents.reset()),
    }),
    [store],
  );

  return { draft, actions };
}
