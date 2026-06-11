/**
 * ENGINES — reserved extension points.
 *
 * These are the seams future AI agents will fill in. Each engine has a stable,
 * minimal interface defined here so components can start depending on the shape
 * before the implementation exists. Nothing here implements real logic yet.
 *
 * Roadmap (do NOT implement prematurely):
 *  - behaviors:       reusable interaction primitives (press, hover, focus, drag)
 *  - intents:         declarative action descriptions decoupled from handlers
 *  - state machines:  finite-state models driving complex components
 *  - effects:         controlled side-effects with logging/time-travel
 *  - collection:      unified data/selection/navigation model (List/Tree/Menu/Grid)
 *  - virtualization:  windowed rendering for large datasets
 *  - accessibility:   focus management, aria wiring, keyboard maps
 */

export type EngineStatus = "planned" | "experimental" | "stable";

export interface EngineDescriptor {
  id: string;
  name: string;
  summary: string;
  status: EngineStatus;
  /** Where a future implementation should live. */
  location: string;
}

export const ENGINES: EngineDescriptor[] = [
  {
    id: "behaviors",
    name: "Behaviors Engine",
    summary: "Composable interaction primitives (press, hover, focus, drag).",
    status: "planned",
    location: "src/framework/engines/behaviors",
  },
  {
    id: "intents",
    name: "Intents Engine",
    summary: "Declarative actions decoupled from concrete event handlers.",
    status: "planned",
    location: "src/framework/engines/intents",
  },
  {
    id: "state-machines",
    name: "State Machine Engine",
    summary: "Finite-state models that drive complex component behavior.",
    status: "planned",
    location: "src/framework/engines/state-machines",
  },
  {
    id: "effects",
    name: "Effects Engine",
    summary: "Controlled side-effects with structured logging and replay.",
    status: "planned",
    location: "src/framework/engines/effects",
  },
  {
    id: "collection",
    name: "Collection Engine",
    summary: "Unified data, selection and navigation model for collections.",
    status: "experimental",
    location: "src/framework/collections",
  },
  {
    id: "virtualization",
    name: "Virtualization Engine",
    summary: "Windowed rendering for very large lists and grids.",
    status: "planned",
    location: "src/framework/engines/virtualization",
  },
  {
    id: "accessibility",
    name: "Accessibility Engine",
    summary: "Focus management, ARIA wiring and keyboard interaction maps.",
    status: "planned",
    location: "src/framework/engines/accessibility",
  },
];
