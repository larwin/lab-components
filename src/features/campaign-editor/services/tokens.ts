import { facadeToken, serviceToken } from "@/framework/services";

import type { CampaignEditorFacade } from "./campaignEditor.facade";
import type { CampaignEditorService } from "./campaignEditor.service";

export const CampaignEditorServiceToken =
  serviceToken<CampaignEditorService>("CampaignEditorService");
export const CampaignEditorFacadeToken = facadeToken<CampaignEditorFacade>("CampaignEditorFacade");
