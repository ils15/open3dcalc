/**
 * Re-export from the web platform App.
 *
 * After Phase 1 codebase unification, App.tsx moved from src/shared/
 * to src/platform/{web,desktop}/App.tsx. This file preserves backward
 * compatibility for tests and any remaining references to the old path.
 *
 * The web platform App is the primary shared App — it composes the shared
 * screens (Calculator, Catalog, Wiki, …) under the Studio shell
 * (`platform/web/components/studio/StudioLayout`), which owns its sidebar and
 * collapses it to an icon rail below 1280px. That rail, not an App-level
 * `<aside>` at a Tailwind breakpoint, is what
 * `shared/__tests__/TabletOptimization.test.tsx` verifies.
 */
export { default } from '@/platform/web/App'
