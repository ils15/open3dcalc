import { lazy } from "react";
export type { GcodePreviewPanelProps } from "./GcodePreviewPanel";
export {
  useOwnedBytes,
  MAX_TOOLPATH_BYTES,
  MAX_TOOLPATH_LINES,
} from "./useOwnedBytes";
export type { OwnedBytesStatus, UseOwnedBytesResult } from "./useOwnedBytes";
export { useObjectDimensions } from "./useObjectDimensions";
export type { DimensionsStatus, ChestnutBounds } from "./useObjectDimensions";

/**
 * The only code-split boundary for the toolpath viewer.
 *
 * `React.lazy` keeps the whole chestnut stack (parser + three renderer) out of
 * the main route bundle. The chunk loads on demand the first time a user opens
 * the preview, and — when `VITE_TOOLPATH_PREVIEW` is off — the entry point is
 * not rendered at all, so the chunk is never even requested.
 *
 * Wrap in `<Suspense>` at the call site; the parent already has a Suspense
 * boundary for the calculator route.
 */
export const LazyGcodePreviewPanel = lazy(async () => {
  const { GcodePreviewPanel } = await import("./GcodePreviewPanel");
  return { default: GcodePreviewPanel };
});
