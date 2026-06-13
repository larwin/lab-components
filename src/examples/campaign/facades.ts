import type { Resolver } from "@/framework/services";

import type { Campaign, CampaignFormModel, CategoryId, Field, Template } from "./model";
import type { CampaignUpsertDto } from "./dto";
import { toCampaignUpsertDto } from "./mappers";
import { categoryIntents, fieldIntents, templateIntents } from "./stores";
import type { ValidationResult } from "./services";
import {
  CampaignRepositoryToken,
  CampaignServiceToken,
  CategoryRepositoryToken,
  CategoryStoreToken,
  ContactServiceToken,
  FieldRepositoryToken,
  FieldStoreToken,
  TelemetryToken,
  TemplateRepositoryToken,
  TemplateStoreToken,
} from "./tokens";

/**
 * Facades — the stable API the UI talks to. A facade is a singleton that never
 * gets invalidated. It holds the resolver (the ONE role allowed to) and
 * re-resolves the current service on every call, so it can never act through a
 * stale, invalidated instance. The UI imports facades and nothing else.
 */

export interface ContactFacade {
  /** Initial load + reload of the custom-field definitions. */
  reloadFields(): Promise<void>;
  /** Append a new required custom field (mocked) — invalidates the services. */
  addCustomField(): Promise<Field>;
  requiredFieldKeys(): readonly string[];
}

export function createContactFacade(resolve: Resolver): ContactFacade {
  const fieldStore = () => resolve.get(FieldStoreToken);
  const fieldRepo = () => resolve.get(FieldRepositoryToken);
  const service = () => resolve.get(ContactServiceToken);

  return {
    async reloadFields() {
      const items = await fieldRepo().list();
      fieldStore().dispatch(fieldIntents.set({ items }));
    },
    async addCustomField() {
      const created = await fieldRepo().create();
      const items = await fieldRepo().list();
      fieldStore().dispatch(fieldIntents.set({ items }));
      return created;
    },
    requiredFieldKeys: () => service().requiredFieldKeys(),
  };
}

export interface SaveResult {
  readonly campaign: Campaign;
  readonly dto: CampaignUpsertDto;
}

export interface ServiceBuilds {
  readonly contact: number;
  readonly campaign: number;
}

export interface CampaignFacade {
  validate(model: CampaignFormModel): ValidationResult;
  templatesForCategory(categoryId: CategoryId | ""): readonly Template[];
  save(model: CampaignFormModel): Promise<SaveResult>;
  reloadCategories(): Promise<void>;
  reloadTemplates(): Promise<void>;
  /** Resolve the services and report how many times each has been (re)built. */
  serviceBuilds(): ServiceBuilds;
}

export function createCampaignFacade(resolve: Resolver): CampaignFacade {
  const service = () => resolve.get(CampaignServiceToken);
  const categoryStore = () => resolve.get(CategoryStoreToken);
  const templateStore = () => resolve.get(TemplateStoreToken);
  const categoryRepo = () => resolve.get(CategoryRepositoryToken);
  const templateRepo = () => resolve.get(TemplateRepositoryToken);
  const campaignRepo = () => resolve.get(CampaignRepositoryToken);
  const telemetry = () => resolve.get(TelemetryToken);

  return {
    validate: (model) => service().validate(model),
    templatesForCategory: (categoryId) => service().templatesForCategory(categoryId),
    async save(model) {
      const result = service().validate(model);
      if (!result.ok) {
        throw new Error(
          `Cannot save an invalid campaign: ${result.issues.map((i) => i.message).join(", ")}`,
        );
      }
      const campaign = await campaignRepo().upsert(model);
      return { campaign, dto: toCampaignUpsertDto(model) };
    },
    async reloadCategories() {
      const items = await categoryRepo().list();
      categoryStore().dispatch(categoryIntents.set({ items }));
    },
    async reloadTemplates() {
      const items = await templateRepo().list();
      templateStore().dispatch(templateIntents.set({ items }));
    },
    serviceBuilds() {
      // Resolving both forces a rebuild if they were invalidated, so the
      // counters reflect the current state right after a data change.
      const t = telemetry();
      resolve.get(ContactServiceToken);
      resolve.get(CampaignServiceToken);
      return { contact: t.contactBuilds, campaign: t.campaignBuilds };
    },
  };
}
