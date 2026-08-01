/**
 * Shared media contract — main ↔ renderer.
 */
export type DownloadedImage = {
  url: string;
  filePath: string;
  mime: string;
  bytes: number;
  sha256: string;
  downloadedAt: string;
};

export type MediaCleanupResult = {
  removed: number;
};