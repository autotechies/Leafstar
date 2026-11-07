/** Every page that gets the screenshot + accessibility treatment. Add each new page here in its step. */
export const pages = [
  // Relative paths (no leading slash) so the same tests run against the GitHub Pages preview sub-folder.
  { name: "home", path: "" },
  { name: "styleguide", path: "dev/styleguide" },
  { name: "image-lab", path: "dev/image-lab" },
  { name: "about", path: "about" },
  { name: "catalog", path: "catalog" },
  { name: "enquiry", path: "enquiry" },
  { name: "contact", path: "contact" },
  { name: "privacy", path: "privacy" },
] as const;

/** DESIGN.md §10: four widths, both themes. */
export const widths = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
] as const;

export const themes = ["light", "dark"] as const;
