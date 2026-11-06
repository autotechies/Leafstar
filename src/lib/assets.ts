/** Address of a file in /public. Needed because the GitHub Pages preview lives in a sub-folder. */
export function assetUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}

/** True in the server-less GitHub Pages preview, where nothing can be saved or uploaded. */
export const isStaticPreview = process.env.NEXT_PUBLIC_IS_PREVIEW === "1";
