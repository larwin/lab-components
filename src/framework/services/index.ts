/**
 * @forge/services — a framework-agnostic dependency-injection + invalidation
 * layer for business services and live stores. Pure TypeScript: no React, no
 * DOM. The React adapter lives in `@/framework/react/services`; a Lit/Vue/Solid
 * adapter would reimplement only that thin layer.
 *
 * See docs/RFC-002-SERVICES-DI-ARCHITECTURE.md for the rationale and the rules.
 */

export {
  type Token,
  type TokenRole,
  type AnyToken,
  type ValueToken,
  type StoreToken,
  type ServiceToken,
  type FacadeToken,
  valueToken,
  storeToken,
  serviceToken,
  facadeToken,
} from "./container/token";

export {
  type Lifetime,
  type Resolver,
  type Provider,
  type Container,
  createContainer,
  defineValue,
  defineSingleton,
  defineStore,
  defineService,
  defineFacade,
  defineTransient,
} from "./container/container";
