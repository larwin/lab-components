// @vitest-environment node
// Pure core: async-data races, cancellation and pagination tested with zero
// async code — requests and responses are just intents and effects.
import { describe, expect, it } from "vitest";
import { createStore } from "../runtime/store";
import { cancelEffect, createLoaderMachine, fetchEffect, loadIntents } from "./loader";
import type { DataPage } from "./source";

interface Row {
  id: number;
}

const page = (ids: number[], nextCursor: string | null, total?: number): DataPage<unknown> => ({
  items: ids.map((id) => ({ id })),
  nextCursor,
  total,
});

const make = () => createStore(createLoaderMachine<Row>({ pageSize: 2 }));

describe("loader machine", () => {
  it("refresh emits a fetch effect with the serialized query", () => {
    const store = make();
    const effects = store.dispatch(loadIntents.refresh(undefined));
    expect(effects).toHaveLength(1);
    expect(fetchEffect.match(effects[0])).toBe(true);
    expect(effects[0].payload).toMatchObject({
      seq: 1,
      query: { cursor: null, limit: 2, filter: "", sort: [] },
    });
    expect(store.getState().status).toBe("loading");
  });

  it("resolve appends the page and tracks the cursor", () => {
    const store = make();
    store.dispatch(loadIntents.refresh(undefined));
    store.dispatch(loadIntents.resolve({ seq: 1, page: page([1, 2], "2", 5) }));
    expect(store.getState()).toMatchObject({
      status: "ready",
      cursor: "2",
      hasMore: true,
      total: 5,
      inflightSeq: null,
    });
    expect(store.getState().items).toHaveLength(2);

    store.dispatch(loadIntents.loadMore(undefined));
    store.dispatch(loadIntents.resolve({ seq: 2, page: page([3, 4], null) }));
    expect(store.getState().items.map((r) => r.id)).toEqual([1, 2, 3, 4]);
    expect(store.getState().hasMore).toBe(false);
    // No more pages → loadMore is a no-op.
    expect(store.dispatch(loadIntents.loadMore(undefined))).toHaveLength(0);
  });

  it("ignores stale responses by sequence — races are impossible", () => {
    const store = make();
    store.dispatch(loadIntents.refresh(undefined)); // seq 1
    store.dispatch(loadIntents.setSort({ sort: [{ field: "id", direction: "desc" }] })); // seq 2
    // The slow seq-1 response lands after the re-sort: must be dropped.
    store.dispatch(loadIntents.resolve({ seq: 1, page: page([99], null) }));
    expect(store.getState().items).toHaveLength(0);
    expect(store.getState().status).toBe("loading");
    store.dispatch(loadIntents.resolve({ seq: 2, page: page([5, 4], "2") }));
    expect(store.getState().items.map((r) => r.id)).toEqual([5, 4]);
  });

  it("starting a new request cancels the in-flight one", () => {
    const store = make();
    store.dispatch(loadIntents.refresh(undefined)); // seq 1 in flight
    const effects = store.dispatch(loadIntents.setFilter({ filter: "x" })); // seq 2
    expect(cancelEffect.match(effects[0])).toBe(true);
    expect(effects[0].payload).toEqual({ seq: 1 });
    expect(fetchEffect.match(effects[1])).toBe(true);
  });

  it("explicit cancel aborts and settles the status", () => {
    const store = make();
    store.dispatch(loadIntents.refresh(undefined));
    const effects = store.dispatch(loadIntents.cancel(undefined));
    expect(cancelEffect.match(effects[0])).toBe(true);
    expect(store.getState().status).toBe("idle");
    // The aborted request's rejection arrives later: stale, ignored.
    store.dispatch(loadIntents.reject({ seq: 1, error: "AbortError" }));
    expect(store.getState().status).toBe("idle");
    expect(store.getState().error).toBeNull();
  });

  it("rejection of the current request surfaces the error", () => {
    const store = make();
    store.dispatch(loadIntents.refresh(undefined));
    store.dispatch(loadIntents.reject({ seq: 1, error: "boom" }));
    expect(store.getState()).toMatchObject({ status: "error", error: "boom" });
  });

  it("query changes reset the window and refetch from the start", () => {
    const store = make();
    store.dispatch(loadIntents.refresh(undefined));
    store.dispatch(loadIntents.resolve({ seq: 1, page: page([1, 2], "2") }));
    const effects = store.dispatch(
      loadIntents.setSort({ sort: [{ field: "id", direction: "asc" }] }),
    );
    expect(store.getState().items).toHaveLength(0);
    expect(store.getState().status).toBe("loading");
    const fetch = effects.find((e) => fetchEffect.match(e))!;
    expect((fetch.payload as { query: { cursor: string | null } }).query.cursor).toBeNull();
  });
});
