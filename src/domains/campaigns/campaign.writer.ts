import type { ApiClient } from "@/platform/http/apiClient";

import { CampaignDtoSchema } from "./dto";
import { toCampaign, toCampaignUpsertDto } from "./mappers";
import type { Campaign, CampaignDraft } from "./model";

/**
 * Write command — the campaigns domain's boundary for persisting a draft.
 * model → DTO happens here (via the mapper), the DTO is posted, the response is
 * parsed and mapped back. A plain function, not a registered service.
 */
export const createCampaignWriter = (api: ApiClient) => ({
  async upsert(draft: CampaignDraft): Promise<Campaign> {
    const raw = await api.post("/campaigns", toCampaignUpsertDto(draft));
    return toCampaign(CampaignDtoSchema.parse(raw));
  },
});
