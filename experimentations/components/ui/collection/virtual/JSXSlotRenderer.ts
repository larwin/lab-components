export interface JSXSlotRenderer {
  hostEl: HTMLElement;
}

export function createJSXSlotRenderer(hostEl: HTMLElement): JSXSlotRenderer {
  return { hostEl };
}
