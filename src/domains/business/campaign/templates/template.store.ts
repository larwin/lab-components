import { defineIntent } from "@/framework/core/runtime/intent";
import { createMachine } from "@/framework/core/runtime/machine";
import { createStore, type Store } from "@/framework/core/runtime/store";

import type { Template, TemplateId } from "./model";

export interface TemplateState {
  readonly all: readonly Template[];
  readonly byId: ReadonlyMap<TemplateId, Template>;
}

export const templateIntents = {
  set: defineIntent<{ items: readonly Template[] }>("template/set"),
};

const index = (items: readonly Template[]): TemplateState => ({
  all: items,
  byId: new Map(items.map((t) => [t.id, t])),
});

export const createTemplateStore = (): Store<TemplateState> =>
  createStore(
    createMachine<TemplateState>({
      id: "template-store",
      initialState: index([]),
      handlers: {
        [templateIntents.set.type]: (_s, i) =>
          index((i.payload as { items: readonly Template[] }).items),
      },
    }),
  );
