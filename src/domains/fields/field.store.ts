import { defineIntent } from "@/framework/core/runtime/intent";
import { createMachine } from "@/framework/core/runtime/machine";
import { createStore, type Store } from "@/framework/core/runtime/store";

import type { Field } from "./model";

export interface FieldState {
  readonly all: readonly Field[];
  readonly byKey: ReadonlyMap<string, Field>;
}

export const fieldIntents = {
  set: defineIntent<{ items: readonly Field[] }>("field/set"),
};

const index = (items: readonly Field[]): FieldState => ({
  all: items,
  byKey: new Map(items.map((f) => [f.key, f])),
});

export const createFieldStore = (): Store<FieldState> =>
  createStore(
    createMachine<FieldState>({
      id: "field-store",
      initialState: index([]),
      handlers: {
        [fieldIntents.set.type]: (_s, i) => index((i.payload as { items: readonly Field[] }).items),
      },
    }),
  );
