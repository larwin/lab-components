// @vitest-environment node
// Pure core: overlay positioning math tested without DOM.
import { describe, expect, it } from "vitest";
import { computePosition, type Rect } from "./positioning";

const viewport: Rect = { x: 0, y: 0, width: 1000, height: 800 };
const anchor: Rect = { x: 400, y: 300, width: 100, height: 40 };
const overlay = { width: 200, height: 150 };

describe("computePosition", () => {
  it("places bottom-start by default with the offset", () => {
    const r = computePosition({ anchor, overlay, boundary: viewport });
    expect(r).toMatchObject({ x: 400, y: 344, placement: "bottom-start" });
  });

  it("aligns end and center on the cross axis", () => {
    expect(
      computePosition({ anchor, overlay, boundary: viewport, placement: "bottom-end" }).x,
    ).toBe(300); // anchor right edge (500) - overlay width
    expect(computePosition({ anchor, overlay, boundary: viewport, placement: "bottom" }).x).toBe(
      350,
    ); // centered on the anchor
  });

  it("positions on the right side with main-axis offset", () => {
    const r = computePosition({
      anchor,
      overlay,
      boundary: viewport,
      placement: "right-start",
      offset: 8,
    });
    expect(r).toMatchObject({ x: 508, y: 300, placement: "right-start" });
  });

  it("flips to the opposite side when the preferred side overflows", () => {
    const lowAnchor: Rect = { ...anchor, y: 700 }; // 56px below → bottom overflows
    const r = computePosition({ anchor: lowAnchor, overlay, boundary: viewport });
    expect(r.placement).toBe("top-start");
    expect(r.y).toBe(700 - 150 - 4);
  });

  it("flips to whichever side overflows least, keeping the preferred side on ties", () => {
    const tinyViewport: Rect = { x: 0, y: 0, width: 1000, height: 200 };
    // bottom overflows by 94, top by 54 → flips to top
    const midAnchor: Rect = { x: 0, y: 100, width: 100, height: 40 };
    expect(computePosition({ anchor: midAnchor, overlay, boundary: tinyViewport }).placement).toBe(
      "top-start",
    );
    // bottom overflows by 4, top by 144 → stays on bottom
    const highAnchor: Rect = { x: 0, y: 10, width: 100, height: 40 };
    expect(computePosition({ anchor: highAnchor, overlay, boundary: tinyViewport }).placement).toBe(
      "bottom-start",
    );
  });

  it("shifts along the cross axis to stay inside the boundary", () => {
    const edgeAnchor: Rect = { x: 950, y: 300, width: 40, height: 40 };
    const r = computePosition({ anchor: edgeAnchor, overlay, boundary: viewport });
    expect(r.x).toBe(800); // clamped to boundary right edge - overlay width
    const startEdge: Rect = { x: -20, y: 300, width: 40, height: 40 };
    expect(computePosition({ anchor: startEdge, overlay, boundary: viewport }).x).toBe(0);
  });

  it("can disable flip and shift", () => {
    const lowAnchor: Rect = { ...anchor, y: 700 };
    const r = computePosition({
      anchor: lowAnchor,
      overlay,
      boundary: viewport,
      flip: false,
      shift: false,
    });
    expect(r.placement).toBe("bottom-start");
    expect(r.y).toBe(744);
  });
});
