import {
  buildWebApplication,
  createMockApi,
  type MockApiOptions,
  type WebApplicationTree,
} from "@/WebApplication";

/**
 * The web TEST host — a single DI entry point for tests, isolated from prod.
 *
 * It builds the SAME scope tree as `WebApplication` (App → Account) but on a
 * zero-latency mock backend, so integration tests never call `buildWebApplication`
 * with a hand-rolled api. Tests import `buildWebTest()` and read facades/stores
 * off the returned `account`.
 */
export function buildWebTest(options: MockApiOptions = {}): WebApplicationTree {
  return buildWebApplication(createMockApi({ latency: 0, ...options }));
}
