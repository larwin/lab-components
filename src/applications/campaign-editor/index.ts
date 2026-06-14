import { defineFacade, defineService, type Container } from "@/framework/services";

import { CategoryStoreToken } from "@/domains/categories";
import { FieldServiceToken } from "@/domains/fields";
import { TemplateStoreToken } from "@/domains/templates";
import { TelemetryToken } from "@/platform/telemetry/telemetry";

import { createCampaignEditorFacade } from "./services/campaignEditor.facade";
import { createCampaignEditorService } from "./services/campaignEditor.service";
import { CampaignEditorFacadeToken, CampaignEditorServiceToken } from "./services/tokens";

export type { CampaignEditorService } from "./services/campaignEditor.service";
export type {
  CampaignEditorFacade,
  SaveResult,
  ServiceBuilds,
} from "./services/campaignEditor.facade";
export { CampaignEditorServiceToken, CampaignEditorFacadeToken } from "./services/tokens";

/**
 * Register the campaign-editor application's container pieces on the Account
 * node. The UI store is NOT here — it is created by the component.
 */
export function registerCampaignEditorApp(account: Container): void {
  account.provide(
    defineService(CampaignEditorServiceToken, {
      inject: {
        categories: CategoryStoreToken,
        templates: TemplateStoreToken,
        field: FieldServiceToken,
        telemetry: TelemetryToken,
      },
      create: ({ categories, templates, field, telemetry }) =>
        createCampaignEditorService(categories, templates, field, telemetry),
    }),
  );
  account.provide(
    defineFacade(CampaignEditorFacadeToken, { create: (r) => createCampaignEditorFacade(r) }),
  );
}
