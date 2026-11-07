/*
  Words on the public pages, in one place so the owner can change them without touching layout.
  Nothing here is a number, certificate or customer claim that has not been confirmed: where the owner
  has not yet supplied real facts the pages show clearly labelled placeholders instead (MANUAL_SETUP.md).
*/

export const nav = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const trustFacts = [
  { title: "Made in our factory", caption: "Every lot is produced in-house" },
  { title: "Wholesale lots", caption: "A minimum order on every article" },
  { title: "Credit for regular buyers", caption: "Terms agreed with you directly" },
  { title: "GST registered", caption: "Proper tax invoices on every order" },
] as const;

export const pillars = [
  { icon: "shield", title: "Honest dealing", body: "We tell you what is in stock, the minimum order and when it can ship, before you commit. If we cannot do something, we say so." },
  { icon: "handshake", title: "A partner, not a one-time seller", body: "We want you to reorder, so we focus on steady quality and simple repeat orders instead of chasing a single big deal." },
  { icon: "headset", title: "Service you can reach", body: "Call us, message us on WhatsApp or send an enquiry. A real person from our team gets back to you." },
] as const;

export const dealSteps = [
  { title: "Enquiry", body: "You pick articles and tell us the pieces you need." },
  { title: "Price and samples", body: "We send our price and, where needed, arrange samples." },
  { title: "Order", body: "You confirm the lot and we agree the terms together." },
  { title: "Production and packing", body: "We prepare your lot at our factory and pack it carefully." },
  { title: "Dispatch", body: "Your goods are sent to you with the bill." },
] as const;

export const processSteps = [
  { title: "Design and pattern", body: "Each article starts as a pattern made for its fit and fabric." },
  { title: "Fabric and cutting", body: "Fabric is checked and cut to the pattern in our factory." },
  { title: "Stitching", body: "Our team stitches each piece in-house." },
  { title: "Finishing", body: "Pieces are trimmed, pressed and folded." },
  { title: "Checking and packing", body: "Finished pieces are checked and packed into lots for dispatch." },
] as const;
