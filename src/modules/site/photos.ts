/*
  The photos on the public pages, one entry per slot (AGENTS.md §9). The files live in public/site and are made by
  `node scripts/prepare-site-photos.mjs <folder of originals>`.

  standIn: true means the picture is a placeholder the owner should replace with a photo of Leaf Star itself before
  going live. `note` says why. The owner's Settings or a developer can find every one by searching for standIn.
*/

export interface SitePhotoInfo {
  src: string;
  width: number;
  height: number;
  /** Describes what is in the picture, never claims it is Leaf Star's own. */
  alt: string;
  standIn: boolean;
  note: string;
}

const FACTORY_NOTE = "Supplied by the owner as a stand-in. Uniforms show another company's badge, so replace with a photo of our own factory before going live.";

export const photos = {
  hero: { src: "/site/hero.webp", width: 1000, height: 1250, alt: "A machinist smiling at her sewing machine on a factory floor", standIn: true, note: FACTORY_NOTE },
  shirts: { src: "/site/shirts.webp", width: 900, height: 1125, alt: "A man in a striped cotton shirt", standIn: true, note: "Looks computer-made and the pocket carries a small logo that resembles a well-known brand. Replace with a photo of a Leaf Star shirt." },
  pants: { src: "/site/pants.webp", width: 900, height: 1125, alt: "Blue denim jeans with folded jeans beside them", standIn: true, note: "Cropped from a denim poster. Replace with a photo of a Leaf Star pant." },
  factory: { src: "/site/factory.webp", width: 1600, height: 900, alt: "A busy factory floor with workers handling fabric", standIn: true, note: FACTORY_NOTE },
  team: { src: "/site/team.webp", width: 1600, height: 900, alt: "Three workers rolling cream fabric at a long table", standIn: true, note: FACTORY_NOTE },
  machinery: { src: "/site/machinery.webp", width: 900, height: 900, alt: "A row of embroidery machines", standIn: true, note: "Stock-style machine photo. Replace with our own machines." },
  cutting: { src: "/site/cutting.webp", width: 1200, height: 900, alt: "Hands marking fabric with chalk before cutting", standIn: true, note: "Stock-style close-up. Replace with our own cutting table." },
  stitching: { src: "/site/stitching.webp", width: 1600, height: 900, alt: "A machinist at work with colleagues behind her", standIn: true, note: FACTORY_NOTE },
} as const satisfies Record<string, SitePhotoInfo>;

export type SitePhotoSlot = keyof typeof photos;
