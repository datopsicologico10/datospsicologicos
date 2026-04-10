/**
 * server.js
 * API REST + arranque del worker de colas (sin Redis, sin servidores externos).
 */

require('dotenv').config();

// Configura el binario de FFmpeg incluido en node_modules (sin instalación del sistema)
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const logger = require('./utils/logger');
const { initializeDatabase, getDashboardStats } = require('./services/analytics-tracker');
const { addVideoToQueue, getQueueStatus } = require('./queue/video-processor');
const { generateScript } = require('./services/content-generator');
const { scoreScript } = require('./utils/virality-scorer');
const { getSpanishVoices } = require('./services/voice-synthesizer');
const hooksData = require('./templates/psychology-hooks.json');
const themesData = require('./templates/visual-themes.json');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
//  MIDDLEWARES
// ─────────────────────────────────────────────

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://psychology-shorts.vercel.app']
    : ['http://localhost:5173', 'http://localhost:3001'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ─────────────────────────────────────────────
//  RUTAS
// ─────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), free: true });
});

app.get('/api/stats', async (_req, res) => {
  try {
    const stats = getDashboardStats();
    res.json({ ok: true, data: stats });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/queue', (_req, res) => {
  try {
    res.json({ ok: true, data: getQueueStatus() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Preview de guión (solo Claude, sin renderizar)
app.post('/api/scripts/preview', async (req, res) => {
  try {
    const { topic, hookId } = req.body;
    const script = await generateScript({ topic, hookId, forceHighScore: false });
    res.json({ ok: true, data: script });
  } catch (err) {
    logger.error(`Script preview error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generar y encolar un video
app.post('/api/videos/generate', async (req, res) => {
  try {
    const { topic, hookId } = req.body;
    const jobId = await addVideoToQueue({ topic, hookId });
    res.json({ ok: true, data: { jobId, message: 'Video added to queue' } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generar lote de N videos
app.post('/api/videos/batch', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.body.count || 3), 10);
    const jobIds = [];
    for (let i = 0; i < count; i++) {
      jobIds.push(await addVideoToQueue({}));
    }
    res.json({ ok: true, data: { jobIds, message: `${count} videos queued` } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Score de viralidad para guión custom
app.post('/api/score', (req, res) => {
  try {
    const { script } = req.body;
    if (!script) return res.status(400).json({ ok: false, error: 'script is required' });
    res.json({ ok: true, data: scoreScript(script) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Templates y configuración
app.get('/api/hooks', (_req, res) => res.json({ ok: true, data: hooksData }));
app.get('/api/themes', (_req, res) => res.json({ ok: true, data: themesData }));
app.get('/api/voices', (_req, res) => res.json({ ok: true, data: getSpanishVoices() }));

// Lista de videos en output/
app.get('/api/videos/local', (_req, res) => {
  const outputDir = path.resolve(process.env.OUTPUT_DIR || './output');
  if (!fs.existsSync(outputDir)) return res.json({ ok: true, data: [] });

  const videos = fs.readdirSync(outputDir)
    .filter((d) => fs.existsSync(path.join(outputDir, d, 'output.mp4')))
    .map((d) => {
      const scriptPath = path.join(outputDir, d, 'script.json');
      const script = fs.existsSync(scriptPath)
        ? JSON.parse(fs.readFileSync(scriptPath, 'utf8'))
        : null;
      return { id: d, script, videoPath: path.join(outputDir, d, 'output.mp4') };
    })
    .reverse();

  res.json({ ok: true, data: videos });
});

// ─────────────────────────────────────────────
//  ERROR HANDLER
// ─────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  logger.error(`Unhandled: ${err.message}`);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ─────────────────────────────────────────────
//  ARRANQUE
// ─────────────────────────────────────────────

async function start() {
  initializeDatabase();
  app.listen(PORT, () => {
    logger.info(`Server on port ${PORT}`);
    logger.info(`Stack: Claude API + Edge TTS (free) + SQLite + FFmpeg`);
  });
}

start();

module.exports = app;
