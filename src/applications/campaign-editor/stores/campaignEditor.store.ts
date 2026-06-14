import { defineIntent } from "@/framework/core/runtime/intent";
import { createMachine } from "@/framework/core/runtime/machine";
import { createStore, type Store } from "@/framework/core/runtime/store";

import type { CategoryId } from "@/domains/business/campaign/categories";
import type { CampaignDraft } from "@/domains/business/campaign/campaigns";
import type { TemplateId } from "@/domains/business/campaign/templates";

import { emptyCampaignForm } from "../forms/campaignForm";

/**
 * CampaignEditorStore — a UI STORE. The screen's draft as observable state.
 * It is pure core logic (portable, Node-testable) but lives OUTSIDE the
 * container: the React/Lit binding creates it per-component and disposes it on
 * unmount, so two open editors are isolated for free (RFC-003 §6).
 */
export type CampaignEditorState = CampaignDraft;

export const editorIntents = {
  setName: defineIntent<{ name: string }>("editor/set-name"),
  setCategory: defineIntent<{ categoryId: CategoryId | "" }>("editor/set-category"),
  setTemplate: defineIntent<{ templateId: TemplateId | null }>("editor/set-template"),
  setCustomValue: defineIntent<{ key: string; value: string }>("editor/set-custom-value"),
  reset: defineIntent<void>("editor/reset"),
};

export const createCampaignEditorStore = (): Store<CampaignEditorState> =>
  createStore(
    createMachine<CampaignEditorState>({
      id: "campaign-editor-store",
      initialState: emptyCampaignForm(),
      handlers: {
        [editorIntents.setName.type]: (s, i) => ({
          ...s,
          name: (i.payload as { name: string }).name,
        }),
        // Changing category invalidates the chosen template (matches the UI rule).
        [editorIntents.setCategory.type]: (s, i) => ({
          ...s,
          categoryId: (i.payload as { categoryId: CategoryId | "" }).categoryId,
          templateId: null,
        }),
        [editorIntents.setTemplate.type]: (s, i) => ({
          ...s,
          templateId: (i.payload as { templateId: TemplateId | null }).templateId,
        }),
        [editorIntents.setCustomValue.type]: (s, i) => {
          const { key, value } = i.payload as { key: string; value: string };
          return { ...s, customValues: { ...s.customValues, [key]: value } };
        },
        [editorIntents.reset.type]: () => emptyCampaignForm(),
      },
    }),
  );
