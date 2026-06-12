import { matchesCombo, parseKeyCombo, type KeyCombo, type KeyStroke, type Platform } from "./keys";

/**
 * Shortcut registry — global, local and contextual shortcuts with scopes.
 *
 * Scopes form a tree mirroring the UI (app → page → overlay → field). At any
 * moment one scope is *active*; a stroke is resolved against the active scope
 * first, then up the ancestor chain. Resolution within a scope: highest
 * priority wins, then most recent registration. This gives:
 *
 *  - global shortcuts: registered on the root scope
 *  - local shortcuts: registered on a component's scope
 *  - contextual: same, plus a `when` predicate
 *  - overlays: opening a dialog activates its scope, masking page shortcuts
 *    (set `blocking: true` to stop ancestor traversal entirely)
 *  - text fields: scopes with `capturesText: true` swallow printable strokes
 *    so "K" doesn't trigger a navigation shortcut while typing.
 *
 * Pure data structure — no DOM listener here. Adapters feed it strokes.
 */

export interface ShortcutBinding {
  readonly id: number;
  readonly combo: KeyCombo;
  readonly comboSource: string;
  readonly scopeId: string;
  readonly priority: number;
  readonly description?: string;
  readonly when?: () => boolean;
  readonly run: (stroke: KeyStroke) => void;
}

export interface ShortcutScope {
  readonly id: string;
  readonly parentId: string | null;
  /** Stop resolution from continuing to ancestors (modal overlays). */
  readonly blocking: boolean;
  /** Swallow printable single-character strokes (text inputs). */
  readonly capturesText: boolean;
}

export interface RegisterOptions {
  keys: string;
  scopeId?: string;
  priority?: number;
  description?: string;
  when?: () => boolean;
  run: (stroke: KeyStroke) => void;
}

export interface ConflictReport {
  combo: string;
  scopeId: string;
  bindings: ShortcutBinding[];
}

export const ROOT_SCOPE = "root";

export interface ShortcutManager {
  defineScope(scope: {
    id: string;
    parentId?: string;
    blocking?: boolean;
    capturesText?: boolean;
  }): () => void;
  /** Push a scope as the active resolution context. Returns a pop function. */
  activate(scopeId: string): () => void;
  getActiveScope(): string;
  register(options: RegisterOptions): () => void;
  /** Resolve and run the best binding for a stroke. Returns true if handled. */
  handle(stroke: KeyStroke): boolean;
  /** Same-combo, same-scope, same-priority collisions — surfaced, not silent. */
  getConflicts(): ConflictReport[];
  getBindings(): readonly ShortcutBinding[];
}

export function createShortcutManager(platform: Platform = "other"): ShortcutManager {
  const scopes = new Map<string, ShortcutScope>([
    [ROOT_SCOPE, { id: ROOT_SCOPE, parentId: null, blocking: false, capturesText: false }],
  ]);
  const bindings = new Map<number, ShortcutBinding>();
  const activeStack: string[] = [ROOT_SCOPE];
  let nextId = 1;

  const chainFrom = (scopeId: string): ShortcutScope[] => {
    const chain: ShortcutScope[] = [];
    let current: ShortcutScope | undefined = scopes.get(scopeId);
    while (current) {
      chain.push(current);
      if (current.blocking) break;
      current = current.parentId ? scopes.get(current.parentId) : undefined;
    }
    return chain;
  };

  return {
    defineScope({ id, parentId = ROOT_SCOPE, blocking = false, capturesText = false }) {
      scopes.set(id, { id, parentId, blocking, capturesText });
      return () => {
        scopes.delete(id);
      };
    },

    activate(scopeId) {
      activeStack.push(scopeId);
      return () => {
        const index = activeStack.lastIndexOf(scopeId);
        if (index > 0) activeStack.splice(index, 1);
      };
    },

    getActiveScope: () => activeStack[activeStack.length - 1],

    register({ keys, scopeId = ROOT_SCOPE, priority = 0, description, when, run }) {
      const id = nextId++;
      bindings.set(id, {
        id,
        combo: parseKeyCombo(keys),
        comboSource: keys,
        scopeId,
        priority,
        description,
        when,
        run,
      });
      return () => {
        bindings.delete(id);
      };
    },

    handle(stroke) {
      const printable = stroke.key.length === 1 && !stroke.ctrl && !stroke.meta && !stroke.alt;
      for (const scope of chainFrom(activeStack[activeStack.length - 1])) {
        let best: ShortcutBinding | null = null;
        for (const binding of bindings.values()) {
          if (binding.scopeId !== scope.id) continue;
          if (!matchesCombo(stroke, binding.combo, platform)) continue;
          if (binding.when && !binding.when()) continue;
          if (
            !best ||
            binding.priority > best.priority ||
            (binding.priority === best.priority && binding.id > best.id)
          ) {
            best = binding;
          }
        }
        if (best) {
          best.run(stroke);
          return true;
        }
        // A text-capturing scope swallows printable keys it didn't bind.
        if (scope.capturesText && printable) return false;
      }
      return false;
    },

    getConflicts() {
      const groups = new Map<string, ShortcutBinding[]>();
      for (const b of bindings.values()) {
        const key = `${b.scopeId}::${b.combo.mod ? "Mod" : ""}${b.combo.ctrl}|${b.combo.meta}|${b.combo.alt}|${b.combo.shift}|${b.combo.key}::${b.priority}`;
        const group = groups.get(key) ?? [];
        group.push(b);
        groups.set(key, group);
      }
      return [...groups.values()]
        .filter((g) => g.length > 1)
        .map((g) => ({ combo: g[0].comboSource, scopeId: g[0].scopeId, bindings: g }));
    },

    getBindings: () => [...bindings.values()],
  };
}
