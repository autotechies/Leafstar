const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL;

if (!key) { console.log("PROBLEM: GEMINI_API_KEY is empty or not being read from .env.local"); process.exit(1); }
if (!model) { console.log("PROBLEM: GEMINI_MODEL is empty or not being read from .env.local"); process.exit(1); }
console.log(`Key found (${key.length} characters). Model: ${model}`);

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": key },
  body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with the single word: OK" }] }] }),
});

const body = await res.json().catch(() => ({}));
console.log("HTTP status:", res.status);
if (res.ok) {
  console.log("SUCCESS. The AI replied:", body.candidates?.[0]?.content?.parts?.[0]?.text);
} else {
  console.log("FAILED:", body.error?.status, "-", body.error?.message);
}

console.log("ronaldo sui");