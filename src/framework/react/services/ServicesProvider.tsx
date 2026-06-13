import { createContext, useContext, type ReactNode } from "react";

import type { Container } from "@/framework/services";
import type { FacadeToken } from "@/framework/services";

/**
 * The React adapter for the services layer — three small hooks over a context,
 * exactly mirroring how `useMachine` bridges the pure core (one
 * `useSyncExternalStore` per store). Nothing here contains business logic.
 *
 * Components are allowed only two doors into the container:
 *   - `useFacade` for stable facades (to act),
 *   - `useStoreValue` for live stores (to react).
 * There is deliberately NO `useService`: a component must never hold a scoped
 * service, because it can be invalidated between renders. The token roles make
 * this a compile-time guarantee, not a convention.
 */

const ContainerContext = createContext<Container | null>(null);

export function ServicesProvider({
  container,
  children,
}: {
  container: Container;
  children: ReactNode;
}) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

/** Escape hatch — composition roots and tests only. Components use the hooks below. */
export function useContainer(): Container {
  const container = useContext(ContainerContext);
  if (!container) {
    throw new Error("useContainer must be used inside a <ServicesProvider>.");
  }
  return container;
}

/**
 * Resolve a stable facade. Facades are singletons that never get invalidated, so
 * resolving on every render is free and always returns the same instance.
 */
export function useFacade<T>(token: FacadeToken<T>): T {
  return useContainer().get(token);
}
