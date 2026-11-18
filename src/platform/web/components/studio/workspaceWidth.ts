import {
  useLayoutStore,
  type WorkspaceWidth,
} from "@/shared/stores/layoutStore";

export const WORKSPACE_CONTAINER_CLASSES: Record<WorkspaceWidth, string> = {
  focused: "max-w-7xl mx-auto w-full",
  standard: "max-w-[100rem] mx-auto w-full",
  wide: "max-w-none mx-auto w-full",
};

export const WORKSPACE_MAIN_PADDING: Record<WorkspaceWidth, string> = {
  focused: "p-3 sm:p-4 lg:px-5 lg:py-6",
  standard: "p-4 sm:p-6 lg:p-8",
  wide: "p-4 sm:p-6 lg:px-8 lg:py-6",
};

export function getWorkspaceContainerClass(width: WorkspaceWidth): string {
  return WORKSPACE_CONTAINER_CLASSES[width];
}

export function useWorkspaceContainerClass(): string {
  const workspaceWidth = useLayoutStore((s) => s.workspaceWidth ?? "standard");
  return getWorkspaceContainerClass(workspaceWidth);
}
