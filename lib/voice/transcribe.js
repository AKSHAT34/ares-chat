// Phase U15 — voice-memo transcription via Company Transcribe Streaming.
//
// Uses the same AWS credential chain (your-aws-profile profile) as the rest of
// ares-chat. NO third-party speech-to-text vendors: the upgrade plan
// mandates AWS-only. (See HERMES-DELTA.md "Out of scope" section for
// the full list of banned third-party providers — referenced by name
// only there, never imported into runtime code.)
//
// Two transports:
//   1. transcribeBuffer({ audio, mediaSampleRateHertz, mediaEncoding,
//                          languageCode })
//        Streams a single in-memory buffer through Transcribe Streaming
//        and returns the final transcript text. Most callers want this.
//
//   2. transcribeStream({ chunks, mediaSampleRateHertz, mediaEncoding,
//                          languageCode, abortSignal })
//        Lower-level — accepts an async iterable of audio chunks (e.g. a
//        WebSocket coming from the browser's MediaRecorder). Yields
//        partial + final transcript events. Reserved for the compact-
//        panel mic flow once we have a streaming client transport.
//
// Defaults:
//   mediaEncoding         "pcm"   (16-bit linear, the format the browser
//                                   MediaRecorder + a small WebAudio
//                                   wrapper most easily produces).
//                                  Other supported values: "ogg-opus", "flac".
//   mediaSampleRateHertz  16000   (Transcribe's recommended low-bandwidth
//                                   sample rate).
//   languageCode          "en-US"

import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from "@aws-sdk/client-transcribe-streaming";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

const REGION = process.env.AWS_REGION || "us-west-2";
const PROFILE = process.env.AWS_PROFILE;

let _client = null;
function getClient() {
  if (_client) return _client;
  _client = new TranscribeStreamingClient({
    region: REGION,
    credentials: fromNodeProviderChain(PROFILE ? { profile: PROFILE } : {}),
    maxAttempts: 2,
  });
  return _client;
}

/**
 * Stream a single audio buffer through Transcribe Streaming and assemble
 * the final transcript. The buffer is split into ~2048-byte chunks so
 * Transcribe sees a reasonable cadence; smaller chunks reduce latency,
 * larger chunks reduce service overhead.
 *
 * @param {object} opts
 * @param {Buffer} opts.audio                  — raw audio bytes
 * @param {string} [opts.mediaEncoding="pcm"]
 * @param {number} [opts.mediaSampleRateHertz=16000]
 * @param {string} [opts.languageCode="en-US"]
 * @param {AbortSignal} [opts.abortSignal]
 * @returns {Promise<{ transcript: string, durationMs: number, partials: string[] }>}
 */
export async function transcribeBuffer({
  audio,
  mediaEncoding = "pcm",
  mediaSampleRateHertz = 16000,
  languageCode = "en-US",
  abortSignal,
} = {}) {
  if (!audio || !Buffer.isBuffer(audio) || audio.length === 0) {
    throw new Error("transcribeBuffer: audio buffer is required");
  }
  const startedAt = Date.now();
  const CHUNK = 2048;
  const audioStream = (async function* () {
    for (let i = 0; i < audio.length; i += CHUNK) {
      if (abortSignal?.aborted) return;
      yield { AudioEvent: { AudioChunk: audio.subarray(i, Math.min(i + CHUNK, audio.length)) } };
    }
  })();

  const cmd = new StartStreamTranscriptionCommand({
    LanguageCode: languageCode,
    MediaEncoding: mediaEncoding,
    MediaSampleRateHertz: mediaSampleRateHertz,
    AudioStream: audioStream,
  });
  const res = await getClient().send(cmd, abortSignal ? { abortSignal } : undefined);

  const partials = [];
  let finalText = "";
  try {
    for await (const event of res.TranscriptResultStream || []) {
      if (abortSignal?.aborted) break;
      const results = event?.TranscriptEvent?.Transcript?.Results || [];
      for (const r of results) {
        const text = r?.Alternatives?.[0]?.Transcript || "";
        if (!text) continue;
        if (r.IsPartial) partials.push(text);
        else finalText += (finalText ? " " : "") + text;
      }
    }
    return {
      transcript: finalText.trim(),
      durationMs: Date.now() - startedAt,
      partials,
    };
  } finally {
    // D-14: explicitly zero the audio buffer once Transcribe has finished
    // reading it. Best practice for sensitive recordings (vendor calls,
    // private dictation). Node won't reuse the underlying memory until
    // GC, but a deliberate fill prevents the contents from lingering in
    // the heap pages a leaked process dump might capture.
    try { audio.fill(0); } catch {}
  }
}

/**
 * Cheap shape probe — does NOT call AWS. Used by the doctor command
 * (Phase U18) to confirm the SDK is wired without spending a request.
 */
export function transcribeProbe() {
  return {
    region: REGION,
    profile: PROFILE || "(default)",
    sdkLoaded: typeof StartStreamTranscriptionCommand === "function",
  };
}
