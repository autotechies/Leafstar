/*
  Turns the assistant's text into blocks the widget can show: paragraphs and bullet lists, with **bold**.
  Nothing else is understood, and the result is plain data (never HTML), so a reply can never inject markup.
*/

export type Inline = { text: string; bold: boolean };
export type Block = { kind: "p"; parts: Inline[] } | { kind: "ul"; items: Inline[][] };

export function inline(text: string): Inline[] {
  const parts: Inline[] = [];
  const pieces = text.split(/\*\*(.+?)\*\*/g);
  pieces.forEach((piece, i) => {
    const clean = piece.replace(/\*+/g, "");
    if (clean) parts.push({ text: clean, bold: i % 2 === 1 });
  });
  return parts;
}

export function formatReply(text: string): Block[] {
  const blocks: Block[] = [];
  let list: Inline[][] | null = null;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      list = null;
      continue;
    }
    const bullet = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      if (!list) {
        list = [];
        blocks.push({ kind: "ul", items: list });
      }
      list.push(inline(bullet[1]));
    } else {
      list = null;
      blocks.push({ kind: "p", parts: inline(line) });
    }
  }
  return blocks;
}
