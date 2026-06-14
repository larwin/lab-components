import type { Store } from "@/framework/core/runtime/store";
import type { AnyToken, FacadeToken, ServiceToken, StoreToken, Token, ValueToken } from "./token";

/**
 * The container — a tiny, hand-rolled DI engine with three deliberate lifetimes,
 * a *composite scope tree* (App → [Agency] → Account), and a *precomputed*,
 * recursion-free invalidation graph.
 *
 * Design decisions (see docs/RFC-002 + RFC-003):
 *  - No DI library, no decorators, no reflect-metadata. The graph is plain data.
 *  - Two dependency graphs, declared separately (RFC-003 §3):
 *      • CONSTRUCTION (`require` + `inject`) — build order, cycle detection, and
 *        the values a factory receives.
 *      • INVALIDATION (`dependency` + `inject`) — the reverse-reach that decides
 *        who is dropped when a reactive store changes.
 *    `inject(X)` is sugar for "require X AND fall when X changes". `require` is
 *    construction-only (a snapshot service: built from X, never dropped by X).
 *    `dependency` is invalidation-only (a pure listener: not passed to the
 *    factory, but dropped when its target changes/dies).
 *  - Composite scopes (RFC-003 §2): a node owns the cache for what it REGISTERS.
 *    Resolving a token registered on an ancestor delegates to that ancestor, so
 *    an App singleton is built once and never duplicated by an Account node.
 *    Invalidating a store cascades DOWN the tree to dependents in child scopes.
 *  - Cycles in the construction graph are rejected eagerly by `validate()` (and
 *    again, defensively, at resolve time). The invalidation cascade walks a
 *    precomputed set, never recurses, and visits each token at most once.
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
  /** Construction deps (`require` + `inject`): build order, cycle check, factory input. */
  readonly buildDeps: readonly AnyToken<unknown>[];
  /** Invalidation deps (`dependency` + `inject`): the reverse-reach graph. */
  readonly reactDeps: readonly AnyToken<unknown>[];
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

/** Dedup tokens by key (a token can appear in both `inject` and `dependency`). */
function uniqueTokens(tokens: readonly AnyToken<unknown>[]): AnyToken<unknown>[] {
  const seen = new Set<symbol>();
  const out: AnyToken<unknown>[] = [];
  for (const t of tokens) {
    if (seen.has(t.key)) continue;
    seen.add(t.key);
    out.push(t);
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
  return {
    token,
    lifetime: "singleton",
    buildDeps: [],
    reactDeps: [],
    reactive: false,
    build: () => value,
  };
}

/** A singleton built from declared deps — repositories, api clients with deps. */
export function defineSingleton<T, D extends InjectMap = Record<string, never>>(
  token: AnyToken<T>,
  def: { inject?: D; create: (deps: Injected<D>) => T; dispose?: (instance: T) => void },
): Provider<T> {
  const deps = depsOf(def.inject);
  return {
    token,
    lifetime: "singleton",
    buildDeps: deps,
    reactDeps: deps,
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
  const deps = depsOf(def.inject);
  return {
    token,
    lifetime: "singleton",
    buildDeps: deps,
    reactDeps: deps,
    reactive: true,
    build: (resolve) => def.create(resolveInjected(def.inject, resolve)),
  };
}

/**
 * A business service — `scoped`. Its factory receives its `inject` and `require`
 * dependencies (never the container), so it cannot hold a stale handle. It is
 * dropped and rebuilt automatically when any INVALIDATION dependency in its
 * closure changes:
 *   - `inject(X)`     → construction + invalidation (the common, default case);
 *   - `require(X)`    → construction only (a snapshot service: built from X, but
 *                       NOT dropped when X changes);
 *   - `dependency(X)` → invalidation only (a pure listener: not passed to the
 *                       factory, dropped when X changes — store — or dies — service).
 */
export function defineService<
  T,
  Inj extends InjectMap = Record<string, never>,
  Req extends InjectMap = Record<string, never>,
>(
  token: ServiceToken<T>,
  def: {
    inject?: Inj;
    require?: Req;
    dependency?: readonly AnyToken<unknown>[];
    create: (deps: Injected<Inj> & Injected<Req>) => T;
    dispose?: (instance: T) => void;
  },
): Provider<T> {
  return {
    token,
    lifetime: "scoped",
    // Construction: everything the factory needs to be born.
    buildDeps: uniqueTokens([...depsOf(def.inject), ...depsOf(def.require)]),
    // Invalidation: inject (couples both) + dependency (fall-only). NOT require.
    reactDeps: uniqueTokens([...depsOf(def.inject), ...(def.dependency ?? [])]),
    reactive: false,
    build: (resolve) =>
      def.create({
        ...resolveInjected(def.inject, resolve),
        ...resolveInjected(def.require, resolve),
      } as Injected<Inj> & Injected<Req>),
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
  return {
    token,
    lifetime: "singleton",
    buildDeps: [],
    reactDeps: [],
    reactive: false,
    build: def.create,
  };
}

/** A transient — a fresh instance per resolve. Pure, stateless compute. */
export function defineTransient<T, D extends InjectMap = Record<string, never>>(
  token: AnyToken<T>,
  def: { inject?: D; create: (deps: Injected<D>) => T },
): Provider<T> {
  const deps = depsOf(def.inject);
  return {
    token,
    lifetime: "transient",
    buildDeps: deps,
    reactDeps: deps,
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
  /** Eagerly check the whole graph: missing deps + construction cycles. Throws with the path. */
  validate(): void;
  /** A child scope (e.g. an Account node) with its own cache; inherits/overrides registrations. */
  createScope(): Container;
  dispose(): void;
}

interface ContainerInternal extends Container {
  lookup(key: symbol): Provider<unknown> | undefined;
  /** Nearest node (self included) whose LOCAL registry owns `key`. */
  ownerOf(key: symbol): ContainerInternal | undefined;
  /** Invalidate `token` here, then cascade DOWN to every child scope. */
  invalidateTree(token: AnyToken<unknown>): void;
  detachChild(child: ContainerInternal): void;
  snapshotProviders(): Provider<unknown>[];
}

export function createContainer(parent?: ContainerInternal): Container {
  const providers = new Map<symbol, Provider<unknown>>();
  const cache = new Map<symbol, unknown>();
  const resolving: symbol[] = [];
  const storeUnsub = new Map<symbol, () => void>();
  const children = new Set<ContainerInternal>();
  // token.key -> set of scoped token keys whose INVALIDATION closure contains it.
  // Recomputed lazily (nulled on every provide) and used by invalidate().
  let reverseScopedReach: Map<symbol, Set<symbol>> | null = null;

  function lookup(key: symbol): Provider<unknown> | undefined {
    return providers.get(key) ?? parent?.lookup(key);
  }

  /** Nearest node (self first, then up) whose LOCAL registry owns `key`. */
  function ownerOf(key: symbol): ContainerInternal | undefined {
    if (providers.has(key)) return api;
    return parent?.ownerOf(key);
  }

  function allProviders(): Provider<unknown>[] {
    const merged = new Map<symbol, Provider<unknown>>();
    // parent first so local registrations win on override
    for (const p of parent?.snapshotProviders() ?? []) merged.set(p.token.key, p);
    for (const [k, p] of providers) merged.set(k, p);
    return [...merged.values()];
  }

  function get<T>(token: AnyToken<T>): T {
    const owner = ownerOf(token.key);
    if (!owner) throw new Error(`No provider registered for token "${token.name}"`);
    // A singleton/store/service/transient is built, cached and (for stores)
    // subscribed in the node that REGISTERS it — never duplicated downstream.
    if (owner !== api) return owner.get(token);

    const provider = providers.get(token.key)!;
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
    // cascades to its scoped dependents — here AND in every child scope. The
    // subscription is the ONLY place reactivity crosses into the container.
    if (provider.reactive && !storeUnsub.has(token.key)) {
      const store = instance as unknown as Store<unknown>;
      storeUnsub.set(
        token.key,
        store.subscribe(() => invalidateTree(token)),
      );
    }
    return instance;
  }

  function provide<T>(provider: Provider<T>): void {
    providers.set(provider.token.key, provider as Provider<unknown>);
    reverseScopedReach = null; // graph changed — force recompute
  }

  /** Depth-first INVALIDATION closure of a token (all tokens whose change drops it). */
  function closureOf(key: symbol, memo: Map<symbol, Set<symbol>>, stack: Set<symbol>): Set<symbol> {
    const cached = memo.get(key);
    if (cached) return cached;
    if (stack.has(key)) return new Set(); // defensive: invalidation cycles are harmless
    stack.add(key);
    const out = new Set<symbol>();
    for (const dep of lookup(key)?.reactDeps ?? []) {
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
      if (!cache.has(key)) continue; // nothing materialized HERE → nothing to drop
      const instance = cache.get(key);
      lookup(key)?.dispose?.(instance);
      cache.delete(key);
    }
  }

  /** Invalidate `token` in this node, then cascade DOWN to every child scope. */
  function invalidateTree(token: AnyToken<unknown>): void {
    invalidate(token);
    for (const child of children) child.invalidateTree(token);
  }

  function validate(): void {
    const all = allProviders();
    // 1. every declared dependency (construction OR invalidation) is registered.
    for (const provider of all) {
      for (const dep of [...provider.buildDeps, ...provider.reactDeps]) {
        if (!lookup(dep.key)) {
          throw new Error(
            `Token "${provider.token.name}" depends on "${dep.name}", which is not registered.`,
          );
        }
      }
    }
    // 2. no cycles in the CONSTRUCTION graph — DFS with a recursion stack, report the path.
    //    (Invalidation cycles are harmless: "they fall together", absorbed by closureOf.)
    const color = new Map<symbol, 0 | 1 | 2>(); // 0=unseen 1=on-stack 2=done
    const nameOf = (k: symbol) => all.find((p) => p.token.key === k)?.token.name ?? "?";
    const walk = (key: symbol, path: symbol[]) => {
      color.set(key, 1);
      for (const dep of lookup(key)?.buildDeps ?? []) {
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
    const child = createContainer(api) as ContainerInternal;
    children.add(child);
    return child;
  }

  function detachChild(child: ContainerInternal): void {
    children.delete(child);
  }

  function dispose(): void {
    for (const child of [...children]) child.dispose();
    for (const unsub of storeUnsub.values()) unsub();
    storeUnsub.clear();
    for (const [key, instance] of cache) lookup(key)?.dispose?.(instance);
    cache.clear();
    reverseScopedReach = null;
    parent?.detachChild(api);
  }

  const api: ContainerInternal = {
    get,
    provide,
    invalidate,
    validate,
    createScope,
    dispose,
    lookup,
    ownerOf,
    invalidateTree,
    detachChild,
    // internal helper for child scopes to read parent registrations
    snapshotProviders: () => allProviders(),
  };

  return api;
}
