// Phase Q19 — AWS Polly Talkback.
//
// SynthesizeSpeechCommand on the same `your-aws-profile` profile we use for
// Bedrock. Caches per text-hash under ~/.ares/cache/polly/ so a re-read
// is instant. Three voices ship by default:
//   - Joanna (en-US, neural) — default
//   - Brian  (en-GB, neural)
//   - Lea    (fr-FR, neural) — for French vendor mail
//
// HTTP shape: GET /api/talkback?text=…&voice=Joanna → audio/mpeg.

import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const REGION = process.env.AWS_REGION || process.env.BEDROCK_REGION || "us-west-2";
const PROFILE = process.env.AWS_PROFILE;

const VOICES = new Set(["Joanna", "Brian", "Lea"]);
const ENGINE_BY_VOICE = { Joanna: "neural", Brian: "neural", Lea: "neural" };
const DEFAULT_VOICE = "Joanna";

const CACHE_DIR = path.join(os.homedir(), ".ares", "cache", "polly");
function _ensureCache() {
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch {}
}

let _client = null;
function getClient() {
  if (_client) return _client;
  _client = new PollyClient({
    region: REGION,
    credentials: fromNodeProviderChain(PROFILE ? { profile: PROFILE } : {}),
    maxAttempts: 2,
  });
  return _client;
}

function _cachePath(text, voice) {
  const h = crypto.createHash("sha256").update(`${voice}:${text}`).digest("hex").slice(0, 32);
  return path.join(CACHE_DIR, `${voice}-${h}.mp3`);
}

export async function synthesize({ text, voice }) {
  const v = VOICES.has(voice) ? voice : DEFAULT_VOICE;
  if (!text || typeof text !== "string") {
    throw new Error("synthesize: text is required");
  }
  // Polly hard-caps at 3000 chars per request; truncate cheerfully.
  const clipped = text.slice(0, 3000);
  _ensureCache();
  const cp = _cachePath(clipped, v);
  if (fs.existsSync(cp)) {
    return { buffer: fs.readFileSync(cp), cached: true, voice: v };
  }
  const cmd = new SynthesizeSpeechCommand({
    Text: clipped,
    VoiceId: v,
    OutputFormat: "mp3",
    Engine: ENGINE_BY_VOICE[v] || "neural",
  });
  const res = await getClient().send(cmd);
  // AudioStream is a Readable in Node — collect to Buffer.
  const chunks = [];
  for await (const chunk of res.AudioStream) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  try { fs.writeFileSync(cp, buffer); } catch {}
  return { buffer, cached: false, voice: v };
}

export function listVoices() {
  return [
    { id: "Joanna", lang: "en-US", description: "Default — US English, neural" },
    { id: "Brian",  lang: "en-GB", description: "UK English, neural" },
    { id: "Lea",    lang: "fr-FR", description: "French, neural — vendor mail" },
  ];
}
