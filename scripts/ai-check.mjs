#!/usr/bin/env node
/*
  Checks that Gemini answers from THIS computer, and how fast. Prints no keys.
  Run:  npm run ai:check
*/
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL;
if (!key || !model) {
  console.log("GEMINI_API_KEY or GEMINI_MODEL is missing in .env.local");
  process.exit(1);
}
console.log(`Model: ${model}`);
const ai = new GoogleGenAI({ apiKey: key });

async function timed(label, fn) {
  const t = Date.now();
  try {
    const out = await fn();
    console.log(`OK   ${label} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
    return out;
  } catch (e) {
    console.log(`FAIL ${label} after ${((Date.now() - t) / 1000).toFixed(1)}s: status=${e?.status ?? "-"} ${String(e?.message ?? e).slice(0, 300)}`);
    if (e?.cause) console.log(`     cause: ${String(e.cause?.code ?? e.cause?.message ?? e.cause).slice(0, 200)}`);
    return null;
  }
}

const ctl = (ms) => AbortSignal.timeout(ms);
const reply = await timed("tiny text question", async () => {
  const r = await ai.models.generateContent({ model, contents: "Reply with the single word: ready", config: { abortSignal: ctl(30000) } });
  return r.text;
});
if (reply) console.log(`Answer: ${String(reply).trim().slice(0, 80)}`);

if (!reply) {
  await timed("list models", async () => {
    const names = [];
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const m of pager) if (/flash/i.test(m.name ?? "")) names.push((m.name ?? "").replace("models/", ""));
    console.log("Flash models your key can use:\n  " + names.join("\n  "));
  });
}
