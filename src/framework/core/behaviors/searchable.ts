import { defineBehavior } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { emitEvent } from "../runtime/effect";
import { withEffects } from "../runtime/machine";

/**
 * Searchable — filter-as-state for ComboBox, AutoComplete and CommandPalette.
 *
 * The behavior owns the query string so it is journaled, replayable and
 * observable like everything else. The *filtering itself* happens outside the
 * machine: the host derives a filtered collection from the query and feeds it
 * back through `config.getCollection()`, so Navigable/Selectable transparently
 * operate on the filtered universe.
 */

export interface SearchableSlice {
  readonly query: string;
}

export const searchIntents = {
  setQuery: defineIntent<{ query: string }>("search/set-query"),
  clear: defineIntent<void>("search/clear"),
};

export const searchable = defineBehavior<"searchable", SearchableSlice, object>({
  name: "searchable",
  initial: () => ({ query: "" }),
  handlers: {
    [searchIntents.setQuery.type]: (slice, intent) => {
      const { query } = intent.payload as { query: string };
      if (query === slice.query) return slice;
      return withEffects({ query }, emitEvent({ name: "queryChange", detail: { query } }));
    },
    [searchIntents.clear.type]: (slice) =>
      slice.query === ""
        ? slice
        : withEffects({ query: "" }, emitEvent({ name: "queryChange", detail: { query: "" } })),
  },
});
