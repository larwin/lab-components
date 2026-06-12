import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  composeMachine,
  focusable,
  focusIntents,
  searchable,
  searchIntents,
  type SearchableSlice,
} from "@/framework/core";
import { useComposedMachine, useForgeEffects, useKeymap, useLiveRef } from "@/framework/react";

/**
 * SearchField — Focusable + Searchable with the standalone keymap: the query
 * lives *in the machine* (journaled, replayable), Escape clears it through a
 * declarative binding that falls through when the field is already empty (so
 * a parent overlay can still close), and Enter emits a `search` event. No
 * conditionals in this shell — the bindings decide.
 */

export interface SearchFieldProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Fired on Enter with the current query. */
  onSearch?: (query: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}

const searchFieldBehaviors = [focusable, searchable] as const;

export function SearchField({
  value,
  defaultValue,
  onValueChange,
  onSearch,
  placeholder,
  disabled = false,
  className,
  ...rest
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const live = useLiveRef({ onValueChange, onSearch });

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("searchfield", searchFieldBehaviors, {
      get disabled() {
        return disabled;
      },
      clearOnEscape: true,
      submitOnEnter: true,
    }),
  );

  const query = (state.searchable as SearchableSlice).query;

  // Initial + controlled value: the machine stays the source of truth and is
  // re-synced from the prop with a program intent (no event echo: events only
  // fire on real change).
  const initial = useRef(value ?? defaultValue ?? "");
  useEffect(() => {
    if (initial.current !== "") {
      dispatch(searchIntents.setQuery({ query: initial.current }, "program"));
      initial.current = "";
    }
  }, [dispatch]);
  useEffect(() => {
    if (value !== undefined && value !== query) {
      dispatch(searchIntents.setQuery({ query: value }, "program"));
    }
  }, [value, query, dispatch]);

  useForgeEffects(store, {
    events: {
      queryChange: (detail) => live.current.onValueChange?.((detail as { query: string }).query),
      search: (detail) => live.current.onSearch?.((detail as { query: string }).query),
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  return (
    <div className={cn("relative w-64", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        aria-label={rest["aria-label"]}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={query}
        onChange={(e) => dispatch(searchIntents.setQuery({ query: e.target.value }, "keyboard"))}
        onKeyDown={onKeyDown}
        onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
        onBlur={() => dispatch(focusIntents.blur(undefined))}
        className={cn(
          "h-9 w-full rounded-md border border-border bg-surface pr-9 pl-9 text-sm transition-colors outline-none",
          "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {query !== "" && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => {
            dispatch(searchIntents.clear(undefined, "pointer"));
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
