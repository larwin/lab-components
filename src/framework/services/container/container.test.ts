// @vitest-environment node
// Pure services layer: these tests run without DOM, browser or React.
import { describe, expect, it, vi } from "vitest";

import { createMachine } from "@/framework/core/runtime/machine";
import { defineIntent } from "@/framework/core/runtime/intent";
import { createStore, type Store } from "@/framework/core/runtime/store";

import {
  createContainer,
  defineFacade,
  defineService,
  defineSingleton,
  defineStore,
  defineTransient,
  defineValue,
} from "./container";
import { facadeToken, serviceToken, storeToken, valueToken } from "./token";

/* A minimal counter store used as a reactive root. */
interface CountState {
  readonly count: number;
}
const bump = defineIntent<void>("test/bump");
const countMachine = () =>
  createMachine<CountState>({
    id: "count",
    initialState: { count: 0 },
    handlers: { [bump.type]: (s) => ({ count: s.count + 1 }) },
  });

describe("container — lifetimes", () => {
  it("transient returns a fresh instance every resolve", () => {
    const c = createContainer();
    const T = valueToken<{ id: number }>("t");
    let n = 0;
    c.provide(defineTransient(T, { create: () => ({ id: ++n }) }));
    expect(c.get(T)).not.toBe(c.get(T));
  });

  it("singleton returns the same instance", () => {
    const c = createContainer();
    const T = valueToken<{ id: number }>("t");
    let n = 0;
    c.provide(defineSingleton(T, { create: () => ({ id: ++n }) }));
    expect(c.get(T)).toBe(c.get(T));
  });

  it("throws a clear error for an unregistered token", () => {
    const c = createContainer();
    const T = valueToken<number>("missing");
    expect(() => c.get(T)).toThrow(/No provider registered for token "missing"/);
  });
});

describe("container — validate()", () => {
  it("rejects a missing dependency with both names", () => {
    const c = createContainer();
    const StoreT = storeToken<CountState>("CountStore");
    const SvcT = serviceToken<object>("Svc");
    // Svc depends on a store that was never provided.
    c.provide(defineService(SvcT, { inject: { store: StoreT }, create: () => ({}) }));
    expect(() => c.validate()).toThrow(/depends on "CountStore", which is not registered/);
  });

  it("detects a dependency cycle and prints the path", () => {
    const c = createContainer();
    const A = serviceToken<object>("A");
    const B = serviceToken<object>("B");
    c.provide(defineService(A, { inject: { b: B }, create: () => ({}) }));
    c.provide(defineService(B, { inject: { a: A }, create: () => ({}) }));
    expect(() => c.validate()).toThrow(/Dependency cycle detected: A → B → A/);
  });

  it("accepts a valid DAG", () => {
    const c = createContainer();
    const StoreT = storeToken<CountState>("CountStore");
    const SvcT = serviceToken<object>("Svc");
    c.provide(defineStore(StoreT, { create: () => createStore(countMachine()) }));
    c.provide(defineService(SvcT, { inject: { store: StoreT }, create: () => ({}) }));
    expect(() => c.validate()).not.toThrow();
  });
});

describe("container — reactive invalidation (the core guarantee)", () => {
  function setup() {
    const c = createContainer();
    const FieldStore = storeToken<CountState>("FieldStore");
    const OtherStore = storeToken<CountState>("OtherStore");
    const ContactSvc = serviceToken<{ builds: number }>("ContactService");
    const CampaignSvc = serviceToken<{ builds: number }>("CampaignService");

    const contactBuild = vi.fn();
    const campaignBuild = vi.fn();

    c.provide(defineStore(FieldStore, { create: () => createStore(countMachine()) }));
    c.provide(defineStore(OtherStore, { create: () => createStore(countMachine()) }));

    // ContactService depends only on FieldStore.
    c.provide(
      defineService(ContactSvc, {
        inject: { fields: FieldStore },
        create: () => {
          contactBuild();
          return { builds: contactBuild.mock.calls.length };
        },
      }),
    );
    // CampaignService depends on OtherStore AND (transitively) on ContactService.
    c.provide(
      defineService(CampaignSvc, {
        inject: { other: OtherStore, contact: ContactSvc },
        create: () => {
          campaignBuild();
          return { builds: campaignBuild.mock.calls.length };
        },
      }),
    );
    c.validate();
    return { c, FieldStore, OtherStore, ContactSvc, CampaignSvc, contactBuild, campaignBuild };
  }

  it("builds a scoped service once, then serves it from cache", () => {
    const { c, ContactSvc, contactBuild } = setup();
    c.get(ContactSvc);
    c.get(ContactSvc);
    expect(contactBuild).toHaveBeenCalledTimes(1);
  });

  it("rebuilds a service exactly once when its store changes", () => {
    const { c, FieldStore, ContactSvc, contactBuild } = setup();
    c.get(ContactSvc); // build #1
    (c.get(FieldStore) as Store<CountState>).dispatch(bump());
    c.get(ContactSvc); // build #2
    c.get(ContactSvc); // cached
    expect(contactBuild).toHaveBeenCalledTimes(2);
  });

  it("cascades transitively: a store change rebuilds the service that depends on the service that depends on the store", () => {
    const { c, FieldStore, CampaignSvc, ContactSvc, campaignBuild, contactBuild } = setup();
    c.get(CampaignSvc); // builds Campaign (+ Contact as a dep)
    expect(contactBuild).toHaveBeenCalledTimes(1);
    expect(campaignBuild).toHaveBeenCalledTimes(1);

    (c.get(FieldStore) as Store<CountState>).dispatch(bump());
    c.get(CampaignSvc);
    expect(contactBuild).toHaveBeenCalledTimes(2);
    expect(campaignBuild).toHaveBeenCalledTimes(2);
  });

  it("invalidates with surgical precision — an unrelated store never rebuilds a service", () => {
    const { c, OtherStore, ContactSvc, contactBuild } = setup();
    c.get(ContactSvc); // build #1
    (c.get(OtherStore) as Store<CountState>).dispatch(bump()); // ContactSvc does NOT depend on OtherStore
    c.get(ContactSvc);
    expect(contactBuild).toHaveBeenCalledTimes(1); // still cached
  });

  it("never drops the live store instance itself on change", () => {
    const { c, FieldStore } = setup();
    const before = c.get(FieldStore);
    (c.get(FieldStore) as Store<CountState>).dispatch(bump());
    expect(c.get(FieldStore)).toBe(before); // same live store, kept across its own changes
  });
});

describe("container — facade re-resolution", () => {
  it("a facade never holds a stale service; it re-resolves the current one", () => {
    const c = createContainer();
    const FieldStore = storeToken<CountState>("FieldStore");
    const Svc = serviceToken<{ snapshot: number }>("Svc");
    const Facade = facadeToken<{ read(): number }>("Facade");

    c.provide(defineStore(FieldStore, { create: () => createStore(countMachine()) }));
    c.provide(
      defineService(Svc, {
        inject: { fields: FieldStore },
        create: ({ fields }) => ({ snapshot: fields.getState().count }),
      }),
    );
    c.provide(
      defineFacade(Facade, { create: (resolve) => ({ read: () => resolve.get(Svc).snapshot }) }),
    );
    c.validate();

    const facade = c.get(Facade);
    expect(facade.read()).toBe(0);
    (c.get(FieldStore) as Store<CountState>).dispatch(bump());
    expect(facade.read()).toBe(1); // facade saw the rebuilt service, without itself changing
    expect(c.get(Facade)).toBe(facade); // facade stays the same stable instance
  });
});

describe("container — scopes", () => {
  it("a child scope overrides a parent registration without touching the parent", () => {
    const parent = createContainer();
    const T = valueToken<string>("env");
    parent.provide(defineValue(T, "prod"));

    const child = parent.createScope();
    child.provide(defineValue(T, "test"));

    expect(parent.get(T)).toBe("prod");
    expect(child.get(T)).toBe("test");
  });
});

describe("container — composite scope tree (RFC-003 §2)", () => {
  it("a parent singleton is built once at its owner, never duplicated by a child resolve", () => {
    const app = createContainer();
    const ApiToken = valueToken<{ id: number }>("ApiClient");
    let n = 0;
    app.provide(defineSingleton(ApiToken, { create: () => ({ id: ++n }) }));

    const account = app.createScope();
    expect(account.get(ApiToken)).toBe(app.get(ApiToken)); // same instance
    expect(n).toBe(1); // built exactly once, at the owner (App)
  });

  it("invalidation cascades DOWN: an App store change rebuilds an Account service that injects it", () => {
    const app = createContainer();
    const AppStore = storeToken<CountState>("AppStore");
    app.provide(defineStore(AppStore, { create: () => createStore(countMachine()) }));

    const account = app.createScope();
    const Svc = serviceToken<{ builds: number }>("AccountSvc");
    const build = vi.fn();
    account.provide(
      defineService(Svc, {
        inject: { store: AppStore },
        create: () => {
          build();
          return { builds: build.mock.calls.length };
        },
      }),
    );
    account.validate();

    account.get(Svc); // build #1 (also materializes + subscribes AppStore at App)
    (app.get(AppStore) as Store<CountState>).dispatch(bump());
    account.get(Svc); // build #2 — dropped by the downward cascade
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("two sibling Account scopes are isolated — invalidating one never touches the other", () => {
    const app = createContainer();
    const AccStore = storeToken<CountState>("AccountStore");
    const Svc = serviceToken<{ builds: number }>("Svc");
    const account = () => {
      const a = app.createScope();
      a.provide(defineStore(AccStore, { create: () => createStore(countMachine()) }));
      const build = vi.fn();
      a.provide(
        defineService(Svc, {
          inject: { s: AccStore },
          create: () => {
            build();
            return { builds: build.mock.calls.length };
          },
        }),
      );
      a.validate();
      return { a, build };
    };

    const a1 = account();
    const a2 = account();
    expect(a1.a.get(AccStore)).not.toBe(a2.a.get(AccStore)); // each account owns its store
    a1.a.get(Svc);
    a2.a.get(Svc);

    (a1.a.get(AccStore) as Store<CountState>).dispatch(bump());
    a1.a.get(Svc);
    a2.a.get(Svc);
    expect(a1.build).toHaveBeenCalledTimes(2); // rebuilt
    expect(a2.build).toHaveBeenCalledTimes(1); // untouched
  });
});

describe("container — require / dependency / inject (RFC-003 §3)", () => {
  it("require(store) builds from the store but is NOT dropped when it changes (snapshot)", () => {
    const c = createContainer();
    const StoreT = storeToken<CountState>("Store");
    const Snapshot = serviceToken<{ at: number }>("SnapshotService");
    const build = vi.fn();
    c.provide(defineStore(StoreT, { create: () => createStore(countMachine()) }));
    c.provide(
      defineService(Snapshot, {
        require: { s: StoreT }, // construction only — no invalidation edge
        create: ({ s }) => {
          build();
          return { at: s.getState().count };
        },
      }),
    );
    c.validate();

    expect(c.get(Snapshot).at).toBe(0); // build #1
    (c.get(StoreT) as Store<CountState>).dispatch(bump());
    expect(c.get(Snapshot).at).toBe(0); // STILL the snapshot — not rebuilt
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("dependency(store) drops the service on change but is NOT passed to the factory", () => {
    const c = createContainer();
    const StoreT = storeToken<CountState>("Store");
    const Listener = serviceToken<{ keys: string[] }>("ListenerService");
    const build = vi.fn();
    c.provide(defineStore(StoreT, { create: () => createStore(countMachine()) }));
    c.provide(
      defineService(Listener, {
        dependency: [StoreT], // invalidation only — not injected
        create: (deps) => {
          build();
          return { keys: Object.keys(deps as object) };
        },
      }),
    );
    c.validate();

    expect(c.get(Listener).keys).toEqual([]); // dependency is not handed to the factory
    (c.get(StoreT) as Store<CountState>).dispatch(bump());
    c.get(Listener);
    expect(build).toHaveBeenCalledTimes(2); // dropped + rebuilt on store change
  });
});
