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
