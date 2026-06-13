import { z } from "zod";

import type { ApiClient } from "./api";
import { CampaignDtoSchema, CategoryDtoSchema, FieldDtoSchema, TemplateDtoSchema } from "./dto";
import { toCampaign, toCategory, toField, toTemplate } from "./mappers";
import type { Campaign, CampaignFormModel, Category, Field, Template } from "./model";
import { toCampaignUpsertDto } from "./mappers";

/**
 * Repositories — the boundary. Each one calls the API, validates the raw
 * payload with zod, and maps it to a domain model. DTOs exist only inside these
 * functions; everything above the repository sees domain models exclusively.
 */

export interface CategoryRepository {
  list(): Promise<readonly Category[]>;
}
export interface TemplateRepository {
  list(): Promise<readonly Template[]>;
}
export interface FieldRepository {
  list(): Promise<readonly Field[]>;
  create(): Promise<Field>;
}
export interface CampaignRepository {
  upsert(model: CampaignFormModel): Promise<Campaign>;
}

export function createCategoryRepository(api: ApiClient): CategoryRepository {
  return {
    async list() {
      const raw = await api.get("/categories");
      return z.array(CategoryDtoSchema).parse(raw).map(toCategory);
    },
  };
}

export function createTemplateRepository(api: ApiClient): TemplateRepository {
  return {
    async list() {
      const raw = await api.get("/templates");
      return z.array(TemplateDtoSchema).parse(raw).map(toTemplate);
    },
  };
}

export function createFieldRepository(api: ApiClient): FieldRepository {
  return {
    async list() {
      const raw = await api.get("/fields");
      return z.array(FieldDtoSchema).parse(raw).map(toField);
    },
    async create() {
      const raw = await api.post("/fields", {});
      return toField(FieldDtoSchema.parse(raw));
    },
  };
}

export function createCampaignRepository(api: ApiClient): CampaignRepository {
  return {
    async upsert(model) {
      // model → DTO happens here, at the boundary, via the explicit mapper.
      const raw = await api.post("/campaigns", toCampaignUpsertDto(model));
      return toCampaign(CampaignDtoSchema.parse(raw));
    },
  };
}
