/**
 * video-processor.js
 * Cola de trabajos sin Redis ni BullMQ.
 * Usa archivos JSON en disco + p-queue para concurrencia.
 * 100% gratis, persistente entre reinicios.
 *
 * Estructura de carpetas:
 *   queue/pending/   → trabajos esperando
 *   queue/active/    → trabajo en curso
 *   queue/done/      → completados (últimos 50)
 *   queue/failed/    → fallidos con error
 */

require('dotenv').config();
const PQueue = require('p-queue').default;
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { generateScript } = require('../services/content-generator');
const { synthesizeVoice } = require('../services/voice-synthesizer');
const { renderVideo } = require('../services/video-renderer');
const { publishAll } = require('../services/publisher');
const { saveVideo, pollAllMetrics } = require('../services/analytics-tracker');
const themes = require('../templates/visual-themes.json');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────
//  PATHS DE LA COLA
// ─────────────────────────────────────────────

const QUEUE_BASE = path.resolve(process.env.QUEUE_DIR || './queue');
const DIRS = {
  pending: path.join(QUEUE_BASE, 'pending'),
  active: path.join(QUEUE_BASE, 'active'),
  done: path.join(QUEUE_BASE, 'done'),
  failed: path.join(QUEUE_BASE, 'failed'),
};

for (const dir of Object.values(DIRS)) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─────────────────────────────────────────────
//  COLA EN MEMORIA (concurrencia 1)
// ─────────────────────────────────────────────

const queue = new PQueue({ concurrency: 1 });
let themeRotationIndex = 0;

// ─────────────────────────────────────────────
//  GESTIÓN DE JOBS EN DISCO
// ─────────────────────────────────────────────

function writeJob(dir, job) {
  const filePath = path.join(dir, `${job.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
  return filePath;
}

function deleteJob(dir, jobId) {
  const filePath = path.join(dir, `${jobId}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function moveJob(fromDir, toDir, job) {
  deleteJob(fromDir, job.id);
  writeJob(toDir, job);
}

function getPendingJobs() {
  return fs.readdirSync(DIRS.pending)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DIRS.pending, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function trimDoneFolder(maxFiles = 50) {
  const files = fs.readdirSync(DIRS.done)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(DIRS.done, f)).mtime }))
    .sort((a, b) => a.mtime - b.mtime);

  while (files.length > maxFiles) {
    fs.unlinkSync(path.join(DIRS.done, files.shift().name));
  }
}

// ─────────────────────────────────────────────
//  PIPELINE PRINCIPAL
// ─────────────────────────────────────────────

async function processPipeline(job) {
  const { topic, hookId, themeIndex } = job.data;
  const videoId = uuidv4();
  const outputDir = path.resolve(process.env.OUTPUT_DIR || './output', videoId);
  fs.mkdirSync(outputDir, { recursive: true });

  logger.info(`[Job ${job.id}] Pipeline start: video ${videoId}`);
  job.progress = 0;
  moveJob(DIRS.pending, DIRS.active, job);

  // 1. Guión con Claude
  logger.info(`[Job ${job.id}] 1/4 Generating script...`);
  const script = await generateScript({ topic, hookId, forceHighScore: true });
  job.progress = 25;
  writeJob(DIRS.active, job);

  // 2. Voz con Edge TTS (gratis)
  logger.info(`[Job ${job.id}] 2/4 Synthesizing voice (Edge TTS)...`);
  const audioPath = path.join(outputDir, 'voice.mp3');
  const { audioDuration } = await synthesizeVoice(script, audioPath);
  job.progress = 50;
  writeJob(DIRS.active, job);

  // 3. Renderizado FFmpeg
  logger.info(`[Job ${job.id}] 3/4 Rendering video...`);
  const themeId = themes.rotation[(themeIndex || 0) % themes.rotation.length];
  const videoPath = path.join(outputDir, 'output.mp4');
  await renderVideo({ script, audioPath, audioDuration, outputPath: videoPath, themeId });
  job.progress = 75;
  writeJob(DIRS.active, job);

  // 4. Publicación
  logger.info(`[Job ${job.id}] 4/4 Publishing...`);
  const { results, errors } = await publishAll(videoPath, script);

  const publishedIds = {};
  for (const r of results) {
    if (r.platform === 'tiktok') publishedIds.tiktokId = r.publishId;
    if (r.platform === 'instagram') publishedIds.instagramId = r.mediaId;
    if (r.platform === 'youtube') publishedIds.youtubeId = r.videoId;
  }

  await saveVideo({
    id: videoId, title: script.title, topic: script.topic, hook: script.hook,
    viralityScore: script.viralityScore, themeId, script, ...publishedIds,
  });

  job.progress = 100;
  job.result = { videoId, platforms: results.map((r) => r.platform), errors };
  job.completedAt = new Date().toISOString();

  moveJob(DIRS.active, DIRS.done, job);
  trimDoneFolder(50);

  logger.info(`[Job ${job.id}] Done! Published to: ${results.map((r) => r.platform).join(', ') || 'none'}`);
  if (errors.length > 0) logger.warn(`[Job ${job.id}] Publish errors: ${JSON.stringify(errors)}`);

  return job.result;
}

// ─────────────────────────────────────────────
//  AÑADIR JOB A LA COLA
// ─────────────────────────────────────────────

async function addVideoToQueue(data = {}) {
  const job = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    progress: 0,
    data: {
      topic: data.topic || null,
      hookId: data.hookId || null,
      themeIndex: themeRotationIndex++,
      ...data,
    },
  };

  writeJob(DIRS.pending, job);
  logger.info(`Job queued: ${job.id}`);

  // Encola en p-queue
  queue.add(async () => {
    try {
      await processPipeline(job);
    } catch (err) {
      logger.error(`[Job ${job.id}] FAILED: ${err.message}`);
      job.error = err.message;
      job.failedAt = new Date().toISOString();
      moveJob(DIRS.active, DIRS.failed, job);
    }
  });

  return job.id;
}

// ─────────────────────────────────────────────
//  RECUPERACIÓN AL ARRANCAR
// ─────────────────────────────────────────────

function recoverPendingJobs() {
  // Si quedaron jobs en active al reiniciar, vuelven a pending
  const activeFiles = fs.readdirSync(DIRS.active).filter((f) => f.endsWith('.json'));
  for (const file of activeFiles) {
    try {
      const job = JSON.parse(fs.readFileSync(path.join(DIRS.active, file), 'utf8'));
      job.progress = 0;
      job.recoveredAt = new Date().toISOString();
      moveJob(DIRS.active, DIRS.pending, job);
      logger.warn(`Recovered interrupted job: ${job.id}`);
    } catch { /* ignorar archivos corruptos */ }
  }

  // Re-encola todos los pending
  const pending = getPendingJobs();
  for (const job of pending) {
    queue.add(async () => {
      try {
        await processPipeline(job);
      } catch (err) {
        logger.error(`[Job ${job.id}] FAILED on recovery: ${err.message}`);
        job.error = err.message;
        job.failedAt = new Date().toISOString();
        moveJob(DIRS.active, DIRS.failed, job);
      }
    });
  }

  if (pending.length > 0) logger.info(`Recovered ${pending.length} pending jobs`);
}

// ─────────────────────────────────────────────
//  ESTADO DE LA COLA
// ─────────────────────────────────────────────

function getQueueStatus() {
  return {
    waiting: fs.readdirSync(DIRS.pending).filter((f) => f.endsWith('.json')).length,
    active: fs.readdirSync(DIRS.active).filter((f) => f.endsWith('.json')).length,
    completed: fs.readdirSync(DIRS.done).filter((f) => f.endsWith('.json')).length,
    failed: fs.readdirSync(DIRS.failed).filter((f) => f.endsWith('.json')).length,
    queueSize: queue.size,
    queuePending: queue.pending,
  };
}

// ─────────────────────────────────────────────
//  CRON JOBS DE PUBLICACIÓN
// ─────────────────────────────────────────────

const publishTimes = (process.env.PUBLISH_TIMES_CET || '15:00,18:00,21:00').split(',');

publishTimes.forEach((time) => {
  const [hour, minute] = time.split(':');
  const cronExpr = `${minute} ${hour} * * *`;

  logger.info(`Scheduled: ${time} CET → ${cronExpr}`);

  cron.schedule(
    cronExpr,
    async () => {
      logger.info(`Cron fired: ${time} CET — queuing video`);
      await addVideoToQueue({ topic: null });
    },
    { timezone: 'Europe/Madrid' }
  );
});

// Polling de analytics cada hora
cron.schedule('0 * * * *', async () => {
  logger.info('Cron: Analytics polling...');
  try {
    await pollAllMetrics();
  } catch (err) {
    logger.error(`Analytics cron failed: ${err.message}`);
  }
});

// ─────────────────────────────────────────────
//  ARRANQUE
// ─────────────────────────────────────────────

recoverPendingJobs();
logger.info(`Video processor ready | Queue dir: ${QUEUE_BASE}`);

module.exports = { addVideoToQueue, getQueueStatus };
