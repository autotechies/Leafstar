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
