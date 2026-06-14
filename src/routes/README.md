# src/routes

**Role:** the playground / living documentation — every interactive feature has a
demo page here, and the routes are the only live consumers of the framework.
**Layer / generation:** support (playground), TanStack Start file-based routing.
**Status:** active.

## Routing

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
is a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx` — those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`. `routeTree.gen.ts` is **auto-generated — never edit it**.

Most pages compose `@/framework/primitives`; ~9 legacy pages still import gen-1
components from the `@/framework` barrel (see [../framework/components/README.md](../framework/components/README.md)).
Demos share the `@/playground` shell and `@/fixtures` datasets.

## Conventions

| File                     | URL                                                     |
| ------------------------ | ------------------------------------------------------- |
| `index.tsx`              | `/`                                                     |
| `about.tsx`              | `/about`                                                |
| `users/index.tsx`        | `/users`                                                |
| `users/$id.tsx`          | `/users/:id` (dynamic — bare `$`, no curly braces)      |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment)                  |
| `files/$.tsx`            | `/files/*` (splat — read via `_splat` param, never `*`) |
| `_layout.tsx`            | layout route (renders children via `<Outlet />`)        |
| `__root.tsx`             | app shell — wraps every page; preserve `<Outlet />`     |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.
