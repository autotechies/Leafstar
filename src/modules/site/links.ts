/* Contact links. Each returns null when the number is missing, so no link ever contains "undefined". */

export function telLink(phone: string | null | undefined): string | null {
  return phone && /^\d{11,13}$/.test(phone) ? `tel:+${phone}` : null;
}

export function whatsappLink(whatsapp: string | null | undefined, text?: string): string | null {
  if (!whatsapp || !/^\d{11,13}$/.test(whatsapp)) return null;
  return `https://wa.me/${whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function instagramLink(handle: string | null | undefined): string | null {
  return handle && /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://instagram.com/${handle}` : null;
}

export function mapsLink(address: string | null | undefined, city?: string | null): string | null {
  const q = [address, city].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export function facebookLink(page: string | null | undefined): string | null {
  if (!page || !/^[A-Za-z0-9.-]{5,60}$/.test(page)) return null;
  return /^\d+$/.test(page) ? `https://www.facebook.com/profile.php?id=${page}` : `https://www.facebook.com/${page}`;
}

/** The address as one line, for display and for the map. */
export function addressLine(address: string | null | undefined, city?: string | null): string {
  return [address, city].filter(Boolean).join(", ");
}

/** Google Maps embed address for the small map in the footer (the link around it opens the full map). */
export function mapEmbedSrc(address: string | null | undefined, city?: string | null): string | null {
  const q = addressLine(address, city);
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed` : null;
}
