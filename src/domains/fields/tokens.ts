import { facadeToken, serviceToken, storeToken } from "@/framework/services";

import type { FieldFacade } from "./field.facade";
import type { FieldService } from "./field.service";
import type { FieldState } from "./field.store";

export const FieldStoreToken = storeToken<FieldState>("FieldStore");
export const FieldServiceToken = serviceToken<FieldService>("FieldService");
export const FieldFacadeToken = facadeToken<FieldFacade>("FieldFacade");
