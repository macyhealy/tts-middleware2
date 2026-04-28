import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const TOKEN = process.env.MIDDLEWARE_TOKEN;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/tts", async (req, res) => {
  try {
    if (req.header("x-middleware-token") !== TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const text = (req.body.text || "").trim();
    const voice = req.body.voice || "marin";
    const tone = (req.body.tone || "Speak in a warm, calm, friendly tone.").trim();
    const format = (req.body.format || "mp3").toLowerCase();
    const speed = Number(req.body.speed || 1);

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const audio = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      input: text,
      voice,
      instructions: tone,
      response_format: format,
      speed,
    });

    const buffer = Buffer.from(await audio.arrayBuffer());

    const mimeTypes = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      aac: "audio/aac",
      flac: "audio/flac",
      opus: "audio/ogg",
      pcm: "application/octet-stream"
    };

    res.setHeader("Content-Type", mimeTypes[format] || "audio/mpeg");
    res.setHeader("Content-Disposition", `inline; filename="speech.${format}"`);
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "tts_failed",
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
