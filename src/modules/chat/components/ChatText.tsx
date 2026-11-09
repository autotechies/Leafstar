import { formatReply } from "../format";

/** The assistant's words: short paragraphs and bullet lists, with bold. Built as elements, never as HTML. */
export function ChatText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {formatReply(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>{b.parts.map((x, j) => (x.bold ? <strong key={j}>{x.text}</strong> : <span key={j}>{x.text}</span>))}</p>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-4">
            {b.items.map((item, k) => (
              <li key={k}>{item.map((x, j) => (x.bold ? <strong key={j}>{x.text}</strong> : <span key={j}>{x.text}</span>))}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
