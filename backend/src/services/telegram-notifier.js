/**
 * telegram-notifier.js
 * Envía notificaciones al bot de Telegram cuando se publica un vídeo.
 * Requiere TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en .env
 */

const axios = require('axios');
const logger = require('../utils/logger');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DASHBOARD_URL = process.env.DASHBOARD_URL || `http://localhost:${process.env.PORT || 3001}`;

function isConfigured() {
  return TOKEN && TOKEN !== 'RELLENAR' && CHAT_ID && CHAT_ID !== 'RELLENAR';
}

async function sendMessage(text) {
  if (!isConfigured()) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
  } catch (err) {
    logger.error(`Telegram error: ${err.response?.data?.description || err.message}`);
  }
}

/**
 * Notificación cuando un vídeo se publica correctamente.
 */
async function notifyVideoPublished({ script, results, errors, videoId }) {
  if (!isConfigured()) return;

  const ytResult = results.find((r) => r.platform === 'youtube');
  const ttResult = results.find((r) => r.platform === 'tiktok');

  const score = script.viralityScore ?? '—';
  const topic = script.topic ?? '—';
  const hook = script.hook ?? '';

  // Líneas de plataformas publicadas
  const platformLines = [];
  if (ytResult?.url) {
    platformLines.push(`🎬 <b>YouTube:</b> <a href="${ytResult.url}">${ytResult.url}</a>`);
  }
  if (ttResult?.publishId) {
    platformLines.push(`🎵 <b>TikTok:</b> publicado (ID: ${ttResult.publishId})`);
  }
  if (errors.length > 0) {
    errors.forEach((e) => platformLines.push(`⚠️ ${e.platform}: ${e.error}`));
  }

  const text =
    `✅ <b>Vídeo publicado</b>\n\n` +
    `🧠 <i>${hook}</i>\n\n` +
    `📊 Viralidad: <b>${score}/100</b>  |  Topic: ${topic}\n\n` +
    (platformLines.length ? platformLines.join('\n') + '\n\n' : '') +
    `📈 <a href="${DASHBOARD_URL}">Ver dashboard</a>`;

  await sendMessage(text);
  logger.info('Telegram: notificación enviada');
}

/**
 * Notificación cuando un job falla.
 */
async function notifyJobFailed({ jobId, error }) {
  if (!isConfigured()) return;
  const text =
    `❌ <b>Error generando vídeo</b>\n\n` +
    `Job: <code>${jobId}</code>\n` +
    `Error: ${error}\n\n` +
    `📈 <a href="${DASHBOARD_URL}">Ver dashboard</a>`;
  await sendMessage(text);
}

/**
 * Notificación cuando se completa la investigación viral.
 */
async function notifyResearchComplete({ totalVideos, newHooks }) {
  if (!isConfigured()) return;
  const text =
    `🔍 <b>Investigación viral completada</b>\n\n` +
    `📹 Vídeos analizados: ${totalVideos}\n` +
    `🪝 Nuevos hooks añadidos: ${newHooks}\n\n` +
    `El generador ha sido actualizado con datos reales.\n` +
    `📈 <a href="${DASHBOARD_URL}/research">Ver insights</a>`;
  await sendMessage(text);
}

module.exports = { notifyVideoPublished, notifyJobFailed, notifyResearchComplete, sendMessage, isConfigured };
