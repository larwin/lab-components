/**
 * @forge/react/services — the React adapter for the services + DI layer.
 *
 * Bridges the framework-agnostic container (`@/framework/services`) to React.
 * A Lit/Vue/Solid adapter would reimplement only this file plus a store
 * controller; the container, stores, services, facades and mappers move
 * unchanged.
 */

export { ServicesProvider, useContainer, useFacade } from "./ServicesProvider";
export { useStoreValue } from "./useStoreValue";
