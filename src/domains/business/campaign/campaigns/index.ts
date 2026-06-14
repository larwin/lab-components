/**
 * Public barrel for the campaigns domain. Pure functions only — no live store,
 * nothing registered in the container (RFC-002: a plain function suffices when
 * there is one implementation and no live dependency). The application layer
 * consumes the writer + mapper.
 */
export type { Campaign, CampaignId, CampaignStatus, CampaignDraft } from "./model";
export type { CampaignDto, CampaignUpsertDto } from "./dto";
export { toCampaign, toCampaignUpsertDto } from "./mappers";
export { createCampaignWriter } from "./campaign.writer";
