import type { Store } from "@/framework/core/runtime/store";

/**
 * Tokens — typed, role-branded handles for things the container can resolve.
 *
 * A token is a unique symbol plus a phantom type. The *role* brand is the spine
 * of the whole design: a developer creates a token with the constructor that
 * matches its role (`storeToken`, `serviceToken`, …), and from then on the type
 * system steers them — `defineStore` only accepts a store token, `useFacade`
 * only accepts a facade token. You cannot wire the wrong kind of thing in, and
 * the role is visible at the declaration site. That is the "impossible to get it
 * wrong" property this layer is built around.
 */

export type TokenRole = "value" | "store" | "service" | "facade";

export interface Token<T, R extends TokenRole = TokenRole> {
  readonly key: symbol;
  readonly name: string;
  readonly role: R;
  /**
   * Phantom carrier — never read at runtime, only makes `T` inferrable.
   * Covariant in `T` (a plain `T`, not `(value: T) => T`) so a role token like
   * `StoreToken<Sub>` is assignable to `AnyToken`; the `role` field, not `T`,
   * is what prevents wiring the wrong KIND of token.
   */
  readonly __type?: T;
}

/** A plain dependency with one implementation: ApiClient, config, a clock. */
export type ValueToken<T> = Token<T, "value">;
/** A live, observable `Store<S>` — a reactive root in the invalidation graph. */
export type StoreToken<S> = Token<Store<S>, "store">;
/** A business service — `scoped`, rebuilt when a reactive dependency changes. */
export type ServiceToken<T> = Token<T, "service">;
/** A stable facade — `singleton`, never invalidated, re-resolves services itself. */
export type FacadeToken<T> = Token<T, "facade">;

/** Any token, used where the role is irrelevant (the resolver, the graph). */
export type AnyToken<T = unknown> = Token<T, TokenRole>;

function make<T, R extends TokenRole>(name: string, role: R): Token<T, R> {
  return { key: Symbol(`${role}:${name}`), name, role };
}

export const valueToken = <T>(name: string): ValueToken<T> => make<T, "value">(name, "value");
export const storeToken = <S>(name: string): StoreToken<S> =>
  make<Store<S>, "store">(name, "store");
export const serviceToken = <T>(name: string): ServiceToken<T> =>
  make<T, "service">(name, "service");
export const facadeToken = <T>(name: string): FacadeToken<T> => make<T, "facade">(name, "facade");
