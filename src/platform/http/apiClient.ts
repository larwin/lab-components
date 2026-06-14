import { valueToken } from "@/framework/services";

/**
 * The HTTP boundary, as a platform value token. Cross-cutting infrastructure —
 * no business knowledge. Mounted at the App node; domains resolve it by walking
 * up the scope tree. The concrete implementation (real client or mock) is
 * provided by the composition root (`src/app`).
 */
export interface ApiClient {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

export const ApiClientToken = valueToken<ApiClient>("ApiClient");
