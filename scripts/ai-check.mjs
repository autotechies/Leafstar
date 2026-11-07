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
  // Try every text Flash model on the key, 15 seconds each, and say which ones answer.
  const names = [];
  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      const n = (m.name ?? "").replace("models/", "");
      if (/flash/i.test(n) && !/image|omni|tts|live|audio/i.test(n) && n !== model) names.push(n);
    }
  } catch (e) {
    console.log("Could not list models:", String(e?.message ?? e).slice(0, 200));
  }
  console.log(`\nTrying ${names.length} other models (15 seconds each)...`);
  const good = [];
  for (const n of names) {
    const t = Date.now();
    try {
      const r = await ai.models.generateContent({ model: n, contents: "Reply with the single word: ready", config: { abortSignal: ctl(15000) } });
      const secs = ((Date.now() - t) / 1000).toFixed(1);
      console.log(`OK   ${n} (${secs}s) answer: ${String(r.text).trim().slice(0, 20)}`);
      good.push(n);
    } catch (e) {
      console.log(`FAIL ${n}: ${String(e?.message ?? e).replace(/\s+/g, " ").slice(0, 140)}`);
    }
  }
  console.log(good.length ? `\nPut one of these in .env.local:  GEMINI_MODEL=${good[0]}\nWorking: ${good.join(", ")}` : "\nNone answered. Check the key / billing in Google AI Studio.");
}
