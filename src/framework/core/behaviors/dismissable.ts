import { defineBehavior } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { emitEvent, restoreFocus } from "../runtime/effect";
import { withEffects } from "../runtime/machine";

/**
 * Dismissable — open/close lifecycle shared by every overlay (menus, popovers,
 * dialogs, combo box listboxes, tooltips). Closing restores focus to the
 * trigger via a declarative effect; Escape is bound here once for everyone.
 */

export interface DismissableSlice {
  readonly open: boolean;
}

export interface DismissableConfig {
  defaultOpen?: boolean;
}

export type DismissReason = "escape" | "outside" | "select" | "program";

export const dismissIntents = {
  open: defineIntent<void>("dismiss/open"),
  close: defineIntent<{ reason?: DismissReason } | void>("dismiss/close"),
  toggle: defineIntent<void>("dismiss/toggle"),
};

const opened = (slice: DismissableSlice) =>
  withEffects({ ...slice, open: true }, emitEvent({ name: "openChange", detail: { open: true } }));

const closed = (slice: DismissableSlice, reason: DismissReason) =>
  withEffects(
    { ...slice, open: false },
    emitEvent({ name: "openChange", detail: { open: false, reason } }),
    restoreFocus(undefined),
  );

export const dismissable = defineBehavior<"dismissable", DismissableSlice, DismissableConfig>({
  name: "dismissable",
  initial: (config) => ({ open: config.defaultOpen ?? false }),
  handlers: {
    [dismissIntents.open.type]: (slice) => (slice.open ? slice : opened(slice)),
    [dismissIntents.close.type]: (slice, intent) => {
      if (!slice.open) return slice;
      const reason =
        (intent.payload as { reason?: DismissReason } | undefined)?.reason ?? "program";
      return closed(slice, reason);
    },
    [dismissIntents.toggle.type]: (slice) =>
      slice.open ? closed(slice, "program") : opened(slice),
  },
  keymap: (slice) =>
    slice.open
      ? [{ keys: "Escape", intent: () => dismissIntents.close({ reason: "escape" }, "keyboard") }]
      : [],
  aria: (slice) => ({ "aria-expanded": slice.open }),
});
