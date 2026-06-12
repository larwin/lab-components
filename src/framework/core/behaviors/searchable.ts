import { defineBehavior, type KeyBinding } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { emitEvent } from "../runtime/effect";
import { withEffects } from "../runtime/machine";

/**
 * Searchable — filter-as-state for ComboBox, AutoComplete, CommandPalette and
 * SearchField.
 *
 * The behavior owns the query string so it is journaled, replayable and
 * observable like everything else. The *filtering itself* happens outside the
 * machine: the host derives a filtered collection from the query and feeds it
 * back through `config.getCollection()`, so Navigable/Selectable transparently
 * operate on the filtered universe.
 *
 * Standalone search fields opt into a declarative keymap: `clearOnEscape`
 * binds Escape → clear *only while the query is non-empty* (an empty field
 * lets Escape bubble to overlays), `submitOnEnter` binds Enter → a `search`
 * output event. Both stay off for composed pickers like ComboBox, where
 * Escape belongs to Dismissable.
 */

export interface SearchableSlice {
  readonly query: string;
}

export interface SearchableConfig {
  /** Bind Escape → `search/clear` while the query is non-empty (SearchField). */
  clearOnEscape?: boolean;
  /** Bind Enter → emit a `search` event with the current query (SearchField). */
  submitOnEnter?: boolean;
}

export const searchIntents = {
  setQuery: defineIntent<{ query: string }>("search/set-query"),
  clear: defineIntent<void>("search/clear"),
  /** Explicit submission (Enter) — emits a `search` output event. */
  submit: defineIntent<void>("search/submit"),
};

export const searchable = defineBehavior<"searchable", SearchableSlice, SearchableConfig>({
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
    [searchIntents.submit.type]: (slice) =>
      withEffects(slice, emitEvent({ name: "search", detail: { query: slice.query } })),
  },
  keymap: (slice, ctx) => {
    const bindings: KeyBinding[] = [];
    if (ctx.config.clearOnEscape) {
      bindings.push({
        keys: "Escape",
        // Empty field: fall through so Escape can dismiss a parent overlay.
        intent: () => (slice.query === "" ? null : searchIntents.clear(undefined, "keyboard")),
      });
    }
    if (ctx.config.submitOnEnter) {
      bindings.push({ keys: "Enter", intent: () => searchIntents.submit(undefined, "keyboard") });
    }
    return bindings;
  },
});
