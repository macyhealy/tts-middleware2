import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

const ALLOWED_FORMATS = new Set(["mp3", "wav", "aac", "flac", "opus", "pcm"]);

const MIME_TYPES = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  flac: "audio/flac",
  opus: "audio/ogg",
  pcm: "application/octet-stream",
};

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "32kb" }));

function clampSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  if (n < 0.25) return 0.25;
  if (n > 4) return 4;
  return n;
}

function requireMiddlewareToken(req, res, next) {
  const token = req.header("x-middleware-token");
  if (!process.env.MIDDLEWARE_TOKEN) {
    return res.status(500).json({ error: "Server missing MIDDLEWARE_TOKEN" });
  }
  if (token !== process.env.MIDDLEWARE_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, date: new Date().toISOString() });
});

app.post("/tts", requireMiddlewareToken, async (req, res) => {
  try {
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    const voice = typeof req.body.voice === "string" ? req.body.voice : "marin";
    const tone =
      typeof req.body.tone === "string" && req.body.tone.trim()
        ? req.body.tone.trim()
        : "Speak in a warm, natural, friendly tone.";
    const format =
      typeof req.body.format === "string"
        ? req.body.format.toLowerCase()
        : "mp3";
    const speed = clampSpeed(req.body.speed);

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    if (!ALLOWED_VOICES.has(voice)) {
      return res.status(400).json({ error: "invalid voice" });
    }

    if (!ALLOWED_FORMATS.has(format)) {
      return res.status(400).json({ error: "invalid format" });
    }

    const audioResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      instructions: tone,
      response_format: format,
      speed,
    });

    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    res.setHeader("Content-Type", MIME_TYPES[format] || "audio/mpeg");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `inline; filename="speech.${format}"`);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("TTS error:", error);

    const status = error?.status || 500;
    const message =
      error?.message || "Failed to generate speech from OpenAI.";

    return res.status(status).json({
      error: "tts_failed",
      message,
    });
  }
});

app.listen(port, () => {
  console.log(`TTS server listening on port ${port}`);
});
