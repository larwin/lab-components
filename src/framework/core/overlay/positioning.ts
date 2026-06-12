/**
 * Positioning — pure rect arithmetic for anchored overlays (menus, popovers,
 * combo box lists, tooltips). No DOM: adapters measure rects and apply the
 * result. Testable in plain Node, like the rest of the core.
 *
 * Supports the standard placement grammar ("bottom-start", "top", "right-end"),
 * main-axis flipping when there is not enough space, and cross-axis shifting
 * to keep the overlay inside the boundary.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";
export type Placement = Side | `${Side}-${Exclude<Align, "center">}`;

export interface PositionInput {
  anchor: Rect;
  overlay: Size;
  /** Usually the viewport rect. */
  boundary: Rect;
  placement?: Placement;
  /** Gap between anchor and overlay on the main axis. */
  offset?: number;
  /** Flip to the opposite side when the preferred side overflows. */
  flip?: boolean;
  /** Slide along the cross axis to stay inside the boundary. */
  shift?: boolean;
}

export interface PositionResult {
  readonly x: number;
  readonly y: number;
  /** The placement actually used (after flipping). */
  readonly placement: Placement;
}

const splitPlacement = (placement: Placement): { side: Side; align: Align } => {
  const [side, align] = placement.split("-") as [Side, Align | undefined];
  return { side, align: align ?? "center" };
};

const OPPOSITE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const coordsFor = (
  side: Side,
  align: Align,
  anchor: Rect,
  overlay: Size,
  offset: number,
): { x: number; y: number } => {
  const alignOn = (start: number, anchorLength: number, overlayLength: number): number => {
    if (align === "start") return start;
    if (align === "end") return start + anchorLength - overlayLength;
    return start + (anchorLength - overlayLength) / 2;
  };
  switch (side) {
    case "bottom":
      return {
        x: alignOn(anchor.x, anchor.width, overlay.width),
        y: anchor.y + anchor.height + offset,
      };
    case "top":
      return {
        x: alignOn(anchor.x, anchor.width, overlay.width),
        y: anchor.y - overlay.height - offset,
      };
    case "right":
      return {
        x: anchor.x + anchor.width + offset,
        y: alignOn(anchor.y, anchor.height, overlay.height),
      };
    case "left":
      return {
        x: anchor.x - overlay.width - offset,
        y: alignOn(anchor.y, anchor.height, overlay.height),
      };
  }
};

const mainAxisOverflow = (
  side: Side,
  pos: { x: number; y: number },
  overlay: Size,
  boundary: Rect,
): number => {
  switch (side) {
    case "bottom":
      return pos.y + overlay.height - (boundary.y + boundary.height);
    case "top":
      return boundary.y - pos.y;
    case "right":
      return pos.x + overlay.width - (boundary.x + boundary.width);
    case "left":
      return boundary.x - pos.x;
  }
};

export function computePosition({
  anchor,
  overlay,
  boundary,
  placement = "bottom-start",
  offset = 4,
  flip = true,
  shift = true,
}: PositionInput): PositionResult {
  const { side, align } = splitPlacement(placement);

  let usedSide = side;
  let pos = coordsFor(side, align, anchor, overlay, offset);

  if (flip) {
    const overflow = mainAxisOverflow(side, pos, overlay, boundary);
    if (overflow > 0) {
      const opposite = OPPOSITE[side];
      const flipped = coordsFor(opposite, align, anchor, overlay, offset);
      // Keep whichever side overflows least.
      if (mainAxisOverflow(opposite, flipped, overlay, boundary) < overflow) {
        usedSide = opposite;
        pos = flipped;
      }
    }
  }

  if (shift) {
    const horizontal = usedSide === "top" || usedSide === "bottom";
    if (horizontal) {
      const max = boundary.x + boundary.width - overlay.width;
      pos = { ...pos, x: Math.min(Math.max(pos.x, boundary.x), Math.max(boundary.x, max)) };
    } else {
      const max = boundary.y + boundary.height - overlay.height;
      pos = { ...pos, y: Math.min(Math.max(pos.y, boundary.y), Math.max(boundary.y, max)) };
    }
  }

  const usedPlacement: Placement =
    align === "center" ? usedSide : (`${usedSide}-${align}` as Placement);
  return { x: pos.x, y: pos.y, placement: usedPlacement };
}
