import type { Store } from "@/framework/core/runtime/store";
import type { AnyToken, FacadeToken, ServiceToken, StoreToken, Token, ValueToken } from "./token";

/**
 * The container — a tiny, hand-rolled DI engine with three deliberate lifetimes
 * and a *precomputed*, recursion-free invalidation graph.
 *
 * Design decisions (see docs/RFC-002):
 *  - No DI library, no decorators, no reflect-metadata. The graph is plain data.
 *  - Dependencies are declared with `inject` and that SAME map is how a factory
 *    receives them. You cannot use a dependency you did not declare, so the
 *    declared graph and the real graph can never drift apart.
 *  - Cycles are rejected eagerly by `validate()` (and again, defensively, at
 *    resolve time). The invalidation cascade walks a precomputed set, never
 *    recurses, and visits each token at most once — runaway recursion is
 *    impossible by construction.
 */

export type Lifetime = "transient" | "singleton" | "scoped";

/** Read-only resolver handed to facade factories (the one place allowed a handle). */
export interface Resolver {
  get<T>(token: AnyToken<T>): T;
}

/** A normalized registration produced by one of the `define*` helpers. */
export interface Provider<T> {
  readonly token: AnyToken<T>;
  readonly lifetime: Lifetime;
  /** Tokens this provider depends on — derived from `inject`, the single source of truth. */
  readonly deps: readonly AnyToken<unknown>[];
  /** True for stores: a change in this instance cascades invalidation to dependents. */
  readonly reactive: boolean;
  readonly build: (resolve: Resolver) => T;
  readonly dispose?: (instance: T) => void;
}

type InjectMap = Record<string, AnyToken>;
type Injected<D extends InjectMap> = {
  [K in keyof D]: D[K] extends AnyToken<infer U> ? U : never;
};

function depsOf(inject?: InjectMap): AnyToken<unknown>[] {
  return inject ? Object.values(inject) : [];
}

function resolveInjected<D extends InjectMap>(
  inject: D | undefined,
  resolve: Resolver,
): Injected<D> {
  const out = {} as Injected<D>;
  if (!inject) return out;
  for (const key of Object.keys(inject)) {
    (out as Record<string, unknown>)[key] = resolve.get(inject[key]);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * define* helpers — each pairs a token role with the only lifetime
 * that makes sense for it, so the developer never picks a lifetime by
 * hand and never picks the wrong one.
 * ------------------------------------------------------------------ */

/** A plain value/singleton with one implementation (ApiClient, config). */
export function defineValue<T>(token: ValueToken<T> | AnyToken<T>, value: T): Provider<T> {
  return { token, lifetime: "singleton", deps: [], reactive: false, build: () => value };
}

/** A singleton built from declared deps — repositories, api clients with deps. */
export function defineSingleton<T, D extends InjectMap = Record<string, never>>(
  token: AnyToken<T>,
  def: { inject?: D; create: (deps: Injected<D>) => T; dispose?: (instance: T) => void },
): Provider<T> {
  return {
    token,
    lifetime: "singleton",
    deps: depsOf(def.inject),
    reactive: false,
    build: (resolve) => def.create(resolveInjected(def.inject, resolve)),
    dispose: def.dispose,
  };
}

/** A live observable store — singleton + reactive root of the invalidation graph. */
export function defineStore<S, D extends InjectMap = Record<string, never>>(
  token: StoreToken<S>,
  def: { inject?: D; create: (deps: Injected<D>) => Store<S> },
): Provider<Store<S>> {
  return {
    token,
    lifetime: "singleton",
    deps: depsOf(def.inject),
    reactive: true,
    build: (resolve) => def.create(resolveInjected(def.inject, resolve)),
  };
}

/**
 * A business service — `scoped`. Its factory receives ONLY its injected deps
 * (never the container), so it cannot hold a stale handle. It is dropped and
 * rebuilt automatically when any reactive dependency in its closure changes.
 */
export function defineService<T, D extends InjectMap = Record<string, never>>(
  token: ServiceToken<T>,
  def: { inject?: D; create: (deps: Injected<D>) => T; dispose?: (instance: T) => void },
): Provider<T> {
  return {
    token,
    lifetime: "scoped",
    deps: depsOf(def.inject),
    reactive: false,
    build: (resolve) => def.create(resolveInjected(def.inject, resolve)),
    dispose: def.dispose,
  };
}

/**
 * A stable facade — `singleton`. It is the one role that receives the resolver,
 * because its whole job is to re-resolve the current service on every call so
 * it never holds an invalidated instance. It never appears as a dependency.
 */
export function defineFacade<T>(
  token: FacadeToken<T>,
  def: { create: (resolve: Resolver) => T },
): Provider<T> {
  return { token, lifetime: "singleton", deps: [], reactive: false, build: def.create };
}

/** A transient — a fresh instance per resolve. Pure, stateless compute. */
export function defineTransient<T, D extends InjectMap = Record<string, never>>(
  token: AnyToken<T>,
  def: { inject?: D; create: (deps: Injected<D>) => T },
): Provider<T> {
  return {
    token,
    lifetime: "transient",
    deps: depsOf(def.inject),
    reactive: false,
    build: (resolve) => def.create(resolveInjected(def.inject, resolve)),
  };
}

/* ------------------------------------------------------------------ *
 * The container.
 * ------------------------------------------------------------------ */

export interface Container extends Resolver {
  provide<T>(provider: Provider<T>): void;
  /** Drop the cached instance of `token` and of every scoped token depending on it. */
  invalidate(token: AnyToken<unknown>): void;
  /** Eagerly check the whole graph: missing deps + cycles. Throws with the path. */
  validate(): void;
  /** A child scope with its own instance cache; inherits/overrides registrations. */
  createScope(): Container;
  dispose(): void;
}

interface ContainerInternal extends Container {
  lookup(key: symbol): Provider<unknown> | undefined;
  snapshotProviders(): Provider<unknown>[];
}

export function createContainer(parent?: ContainerInternal): Container {
  const providers = new Map<symbol, Provider<unknown>>();
  const cache = new Map<symbol, unknown>();
  const resolving: symbol[] = [];
  const storeUnsub = new Map<symbol, () => void>();
  // token.key -> set of scoped token keys whose dependency closure contains it.
  // Recomputed lazily (nulled on every provide) and used by invalidate().
  let reverseScopedReach: Map<symbol, Set<symbol>> | null = null;

  function lookup(key: symbol): Provider<unknown> | undefined {
    return providers.get(key) ?? parent?.lookup(key);
  }

  function allProviders(): Provider<unknown>[] {
    const merged = new Map<symbol, Provider<unknown>>();
    // parent first so local registrations win on override
    for (const p of parent?.snapshotProviders() ?? []) merged.set(p.token.key, p);
    for (const [k, p] of providers) merged.set(k, p);
    return [...merged.values()];
  }

  function get<T>(token: AnyToken<T>): T {
    const provider = lookup(token.key);
    if (!provider) throw new Error(`No provider registered for token "${token.name}"`);

    if (provider.lifetime === "transient") return provider.build(api) as T;
    if (cache.has(token.key)) return cache.get(token.key) as T;

    if (resolving.includes(token.key)) {
      const path = [...resolving, token.key].map((k) => k.description ?? "?").join(" → ");
      throw new Error(`Dependency cycle detected while resolving: ${path}`);
    }
    resolving.push(token.key);
    let instance: T;
    try {
      instance = provider.build(api) as T;
    } finally {
      resolving.pop();
    }
    cache.set(token.key, instance);

    // First time a reactive store is materialized, subscribe once so any change
    // cascades to its scoped dependents. The subscription is the ONLY place
    // reactivity crosses into the container.
    if (provider.reactive && !storeUnsub.has(token.key)) {
      const store = instance as unknown as Store<unknown>;
      storeUnsub.set(
        token.key,
        store.subscribe(() => invalidate(token)),
      );
    }
    return instance;
  }

  function provide<T>(provider: Provider<T>): void {
    providers.set(provider.token.key, provider as Provider<unknown>);
    reverseScopedReach = null; // graph changed — force recompute
  }

  /** Depth-first dependency closure of a token (all tokens it transitively needs). */
  function closureOf(key: symbol, memo: Map<symbol, Set<symbol>>, stack: Set<symbol>): Set<symbol> {
    const cached = memo.get(key);
    if (cached) return cached;
    if (stack.has(key)) return new Set(); // defensive: cycle already reported by validate()
    stack.add(key);
    const out = new Set<symbol>();
    for (const dep of lookup(key)?.deps ?? []) {
      out.add(dep.key);
      for (const k of closureOf(dep.key, memo, stack)) out.add(k);
    }
    stack.delete(key);
    memo.set(key, out);
    return out;
  }

  function ensureReach(): Map<symbol, Set<symbol>> {
    if (reverseScopedReach) return reverseScopedReach;
    const reach = new Map<symbol, Set<symbol>>();
    const memo = new Map<symbol, Set<symbol>>();
    const add = (depKey: symbol, scopedKey: symbol) => {
      (reach.get(depKey) ?? reach.set(depKey, new Set()).get(depKey)!).add(scopedKey);
    };
    for (const provider of allProviders()) {
      if (provider.lifetime !== "scoped") continue;
      const self = provider.token.key;
      add(self, self); // invalidate(self) must also drop self
      for (const depKey of closureOf(self, memo, new Set())) add(depKey, self);
    }
    reverseScopedReach = reach;
    return reach;
  }

  function invalidate(token: AnyToken<unknown>): void {
    const dependents = ensureReach().get(token.key);
    if (!dependents) return;
    for (const key of dependents) {
      if (!cache.has(key)) continue; // nothing materialized → nothing to drop
      const instance = cache.get(key);
      lookup(key)?.dispose?.(instance);
      cache.delete(key);
    }
  }

  function validate(): void {
    const all = allProviders();
    // 1. every declared dependency is registered.
    for (const provider of all) {
      for (const dep of provider.deps) {
        if (!lookup(dep.key)) {
          throw new Error(
            `Token "${provider.token.name}" depends on "${dep.name}", which is not registered.`,
          );
        }
      }
    }
    // 2. no cycles — DFS with a recursion stack, report the exact path.
    const color = new Map<symbol, 0 | 1 | 2>(); // 0=unseen 1=on-stack 2=done
    const nameOf = (k: symbol) => all.find((p) => p.token.key === k)?.token.name ?? "?";
    const walk = (key: symbol, path: symbol[]) => {
      color.set(key, 1);
      for (const dep of lookup(key)?.deps ?? []) {
        const c = color.get(dep.key) ?? 0;
        if (c === 1) {
          const cycle = [...path, key, dep.key].map(nameOf).join(" → ");
          throw new Error(`Dependency cycle detected: ${cycle}`);
        }
        if (c === 0) walk(dep.key, [...path, key]);
      }
      color.set(key, 2);
    };
    for (const provider of all)
      if ((color.get(provider.token.key) ?? 0) === 0) walk(provider.token.key, []);
    // 3. warm the reach cache so the first invalidation is cheap.
    ensureReach();
  }

  function createScope(): Container {
    return createContainer(api as ContainerInternal);
  }

  function dispose(): void {
    for (const unsub of storeUnsub.values()) unsub();
    storeUnsub.clear();
    for (const [key, instance] of cache) lookup(key)?.dispose?.(instance);
    cache.clear();
    reverseScopedReach = null;
  }

  const api: ContainerInternal = {
    get,
    provide,
    invalidate,
    validate,
    createScope,
    dispose,
    lookup,
    // internal helper for child scopes to read parent registrations
    snapshotProviders: () => allProviders(),
  };

  return api;
}
