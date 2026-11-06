/** One processed photo, as stored in article_images and returned by /api/images/process. */
export interface Photo {
  /** Stable key for React lists. */
  id: string;
  thumbUrl: string;
  mediumUrl: string;
  /** The large master used for zoom. */
  url: string;
  blurDataUrl?: string | null;
  width: number;
  height: number;
  alt: string;
}
