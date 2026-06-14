import type { Resolver } from "@/framework/services";

import type { CategoryId } from "@/domains/categories";
import {
  createCampaignWriter,
  toCampaignUpsertDto,
  type Campaign,
  type CampaignDraft,
  type CampaignUpsertDto,
} from "@/domains/campaigns";
import { FieldServiceToken, type ValidationResult } from "@/domains/fields";
import type { Template } from "@/domains/templates";
import { ApiClientToken } from "@/domains/technical/http/apiClient";
import { TelemetryToken } from "@/domains/technical/telemetry/telemetry";

import { CampaignEditorServiceToken } from "./tokens";

export interface SaveResult {
  readonly campaign: Campaign;
  readonly dto: CampaignUpsertDto;
}

export interface ServiceBuilds {
  readonly field: number;
  readonly editor: number;
}

export interface CampaignEditorFacade {
  validate(draft: CampaignDraft): ValidationResult;
  templatesForCategory(categoryId: CategoryId | ""): readonly Template[];
  save(draft: CampaignDraft): Promise<SaveResult>;
  /** Resolve the services and report how many times each has been (re)built. */
  serviceBuilds(): ServiceBuilds;
}

export function createCampaignEditorFacade(resolve: Resolver): CampaignEditorFacade {
  const service = () => resolve.get(CampaignEditorServiceToken);
  const writer = createCampaignWriter(resolve.get(ApiClientToken));
  const telemetry = () => resolve.get(TelemetryToken);

  return {
    validate: (draft) => service().validate(draft),
    templatesForCategory: (categoryId) => service().templatesForCategory(categoryId),
    async save(draft) {
      const result = service().validate(draft);
      if (!result.ok) {
        throw new Error(
          `Cannot save an invalid campaign: ${result.issues.map((i) => i.message).join(", ")}`,
        );
      }
      const campaign = await writer.upsert(draft);
      return { campaign, dto: toCampaignUpsertDto(draft) };
    },
    serviceBuilds() {
      // Resolving both forces a rebuild if they were invalidated.
      const t = telemetry();
      resolve.get(FieldServiceToken);
      resolve.get(CampaignEditorServiceToken);
      return { field: t.fieldServiceBuilds, editor: t.editorServiceBuilds };
    },
  };
}
