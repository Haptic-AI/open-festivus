# Haptic Website - Coding Guide

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5.7+ (strict mode)
- **React:** 19
- **Styling:** Tailwind CSS v4
- **Package Manager:** pnpm
- **Deployment:** Vercel

## Rules

### Always Run Before Committing

```bash
pnpm check
```

This runs `pnpm typecheck && pnpm lint && pnpm build` which must all pass with **zero errors and zero warnings**.

- `pnpm typecheck` runs `tsc --noEmit`
- `pnpm lint` runs `eslint . --max-warnings 0`
- `pnpm build` runs `next build` — catches CSS parsing, module resolution, and runtime build errors that typecheck and lint miss

Do not commit code that fails any check.

### TypeScript

- Strict mode enabled. No `any` types unless absolutely necessary.
- Interface names must be prefixed with `I` (e.g., `IBlogPost`, `IBlogSection`).
- Use `=== undefined` / `=== null` instead of truthy/falsy checks for strict boolean expressions.
- Use `??` (nullish coalescing) instead of `||` for fallback values.
- Use template literals instead of string concatenation.
- No non-null assertions (`!`). Use explicit guards instead.
- `noUnusedLocals` and `noUnusedParameters` are enabled. Remove dead code, do not comment it out.
- `noUncheckedIndexedAccess` is enabled. Array/object index access returns `T | undefined`. Handle it.
- `verbatimModuleSyntax` is enabled. Use `import type` for type-only imports.

### ESLint

- Props must be sorted alphabetically in JSX (`react/jsx-sort-props`).
- Shorthand props (like `fill`) must come before other props.
- No nested ternaries. Use separate conditionals.
- No empty functions. Use a named noop or add a comment.
- Escape special characters in JSX text (`&apos;` not `'`).
- Curly braces required after `if` conditions.
- No `require()` imports. Use ES module `import` syntax.
- No `console.log`. Use `console.warn` or `console.error` if needed.

### CSS / Tailwind

- In `globals.css`, external `@import url(...)` statements must come **before** `@import "tailwindcss"`. CSS requires `@import` rules to precede all other rules except `@charset` and `@layer`. Tailwind v4 expands into a large CSS block, so anything after it is treated as "after all rules."
- Use `@theme { }` blocks for custom design tokens (colors, fonts). Place after the tailwind import.
- Custom utility classes (`.blueprint-grid`, etc.) go after the `@theme` block.

## Next.js Patterns

### Server Components (default)

All components in `app/` are Server Components by default. Keep them that way unless you need interactivity.

**Server Components should:**
- Fetch data directly (no useEffect, no client-side fetching)
- Export `metadata` or `generateMetadata` for SEO
- Render static content, pass data down to Client Components when needed
- Use `async` when they need to await data

**Do not add `"use client"` unless the component uses:**
- Hooks (`useState`, `useEffect`, `usePathname`, etc.)
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser-only APIs (`window`, `document`, `localStorage`)

### Client Components

- Add `"use client"` as the very first line.
- Keep them small. Extract the interactive part into a Client Component and keep the rest server-rendered.
- Do not fetch data in Client Components. Receive it as props from a Server Component parent.
- Do not export `metadata` from Client Components. It only works in Server Components.

### Route Handlers (API Routes)

- Place in `app/api/<name>/route.ts`.
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`.
- Validate input at the boundary. Use Zod for request body validation.
- Return `NextResponse.json()` with appropriate status codes.
- Keep secrets server-side. Never expose API keys to the client.

### Claude API / Tool Use

- When using Claude API with tools, always implement a multi-turn loop. The LLM stops after returning tool calls (`stop_reason: "tool_use"`). You must send tool results back and let it continue. Without this, the LLM only makes one set of tool calls before stopping.
- Cap the loop (e.g., 5 turns) to prevent infinite loops.
- Stream events to the frontend as they arrive, don't wait for the full loop to complete.
- Test every LLM integration with `curl` to verify tool calls are actually returned before shipping.

### Metadata & SEO

Every page must export `metadata` (static) or `generateMetadata` (dynamic):

```tsx
export const metadata: Metadata = {
  title: "Page Title | Haptic",
  description: "...",
  openGraph: { title: "...", description: "...", type: "website" },
}
```

- Include `openGraph` and `twitter` card data on all pages.
- OG images must be JPEG, under 300KB.
- Use `generateMetadata` for dynamic routes (blog posts).

### Layouts vs Pages

- `layout.tsx` wraps child routes and persists across navigation. Use for shared UI (header, footer, providers).
- `page.tsx` is the unique content for a route.
- Do not put page-specific content in layouts.
- The `<Header />` is rendered per-page, not in the root layout. The root layout contains `<Footer />` and providers.

### Dynamic Routes

- Use `generateStaticParams` for static generation of dynamic routes.
  **Exception:** routes that fetch from an external API at build time (e.g. `/data/*/[slug]`) — skip `generateStaticParams` and rely on `dynamicParams = true` + ISR (`next.revalidate` in the fetch). Build-time API fan-out is throttled by Cloudflare on `hapticlabs.ai` and dies on any one slow slug; see PR #54.
- Return `notFound()` for invalid params, not a blank page.
- Type params with `Promise<{ ... }>` (Next.js 16 async params).

## React Patterns

### Component Structure

- One component per file. Name the file after the component (`header.tsx` exports `Header`).
- Use named exports, not default exports (except for pages which require default).
- Props interfaces prefixed with `I` and defined above the component.
- Destructure props in the function signature.

### State Management

- Use React Context sparingly and only for truly global UI state (sidebar open/closed).
- Do not use Context for data that could be passed as props through 1-2 levels.
- No external state libraries. The app is simple enough for props + context.

### Lists and Keys

- Always use a stable, unique key. Never use array index as key unless the list is static and never reordered.
- Prefer `item.id` or `item.slug` as key.

### Event Handlers

- Name handlers `handleX` (e.g., `handleSubmit`, `handleClick`).
- For forms, use `onSubmit` on the form element, not `onClick` on the button.
- Always call `e.preventDefault()` in form submit handlers.

### Conditional Rendering

- Use `&&` for simple show/hide: `{isOpen && <Menu />}`.
- Use ternary for if/else: `{isActive ? "navy" : "gray"}`.
- For complex conditions, extract to a variable or early return.

### Images

- Use `next/image` with `unoptimized` prop (image optimization is disabled in config).
- Always include `alt` text.
- Provide `width` and `height` to prevent layout shift.
- Blog/OG images must be JPEG, under 300KB.
- Compress with: `sips -s format jpeg -s formatOptions 82 --resampleWidth 1400 input.png --out output.jpg`

## File Structure

```
app/                    # Next.js App Router pages and API routes
  api/                  # Route handlers (server-side only)
  blog/                 # Blog index and dynamic post routes
  [page]/               # Static pages (team, deploy, etc.)
components/             # Shared React components
content/blog/           # Blog post content (TSX components)
lib/                    # Utilities, types, data (blog.ts, structured-data.tsx)
public/                 # Static assets (images, robots.txt, llms.txt)
docs/                   # Canonical documentation
```

### Naming Conventions

- Files: kebab-case (`email-capture.tsx`, `nav-drawer.tsx`)
- Components: PascalCase (`EmailCapture`, `NavDrawer`)
- Utilities/hooks: camelCase (`formatDate`, `useSidebar`)
- Types/interfaces: PascalCase with `I` prefix (`IBlogPost`)
- Constants: UPPER_SNAKE_CASE (`SITE_URL`)

## Blog Post Workflow

1. Create content component in `content/blog/<slug>.tsx`
2. Register in `content/blog/index.ts` (ES import, not require)
3. Add post metadata to `lib/blog.ts` (slug, title, description, author, publishedAt, image)
4. Run `pnpm check`

## Performance

- Prefer Server Components. They send zero JS to the client.
- Lazy-load heavy Client Components with `next/dynamic` if they are below the fold.
- Do not import large libraries in Client Components unless necessary. Check bundle impact.
- Use `loading.tsx` for route-level suspense boundaries on slow pages.

## UI

- All pages must be mobile-first and responsive. No exceptions.
- All text must meet WCAG AA contrast ratio (4.5:1 minimum). No light gray text on light backgrounds.
- On cream backgrounds, use `text-blueprint-navy` for primary text and `text-blueprint-navy/70` for secondary. Never use `/40` or `/50` opacity for readable text.
- `cold-gray` (#6B7280) is the minimum for secondary text on cream. The old value (#A3A7AC) failed WCAG AA.

## SEO / Social

- All pages must have proper Open Graph meta tags (title, description, image).
- OG images must be exactly 1200x630px, JPEG, under 300KB.
- Never stretch images to fit OG dimensions. Resize to fit height, then pad with brand cream (#EFECE4):
  ```bash
  sips --resampleHeight 630 -s format jpeg -s formatOptions 82 input.png --out /tmp/resized.jpg
  sips -p 630 1200 --padColor EFECE4 /tmp/resized.jpg --out output.jpg
  ```
- Each page should have a unique title and description.

## Copy Style

- Never use em dashes. Use commas, periods, or restructure.
- Use "Physical AI" not "robotics" for the broader category.
- Keep copy concise. No buzzwords or marketing speak.
