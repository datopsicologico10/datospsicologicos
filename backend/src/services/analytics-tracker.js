/**
 * analytics-tracker.js
 * Base de datos en JSON (sin dependencias nativas).
 * Guarda videos y métricas en archivos JSON locales.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

const DATA_DIR = path.resolve(path.dirname(process.env.SQLITE_DB_PATH || './data/db'), '.');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');

// ─────────────────────────────────────────────
//  HELPERS DE LECTURA/ESCRITURA
// ─────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, defaultValue = []) {
  try {
    if (!fs.existsSync(file)) return defaultValue;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return defaultValue;
  }
}

function writeJSON(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────

function initializeDatabase() {
  ensureDataDir();
  if (!fs.existsSync(VIDEOS_FILE)) writeJSON(VIDEOS_FILE, []);
  if (!fs.existsSync(METRICS_FILE)) writeJSON(METRICS_FILE, []);
  logger.info(`JSON database ready: ${DATA_DIR}`);
}

// ─────────────────────────────────────────────
//  VIDEOS
// ─────────────────────────────────────────────

function saveVideo(videoData) {
  const videos = readJSON(VIDEOS_FILE);
  const existing = videos.findIndex((v) => v.id === videoData.id);
  const record = {
    id: videoData.id,
    title: videoData.title,
    topic: videoData.topic,
    hook: videoData.hook,
    virality_score: videoData.viralityScore,
    tiktok_id: videoData.tiktokId || null,
    instagram_id: videoData.instagramId || null,
    youtube_id: videoData.youtubeId || null,
    theme_id: videoData.themeId,
    script_json: videoData.script,
    status: 'published',
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  if (existing >= 0) {
    videos[existing] = { ...videos[existing], ...record };
  } else {
    videos.push(record);
  }

  writeJSON(VIDEOS_FILE, videos);
  logger.info(`Video saved: ${videoData.id}`);
}

// ─────────────────────────────────────────────
//  MÉTRICAS
// ─────────────────────────────────────────────

function insertMetric({ videoId, platform, views, likes, comments, shares, engagementRate }) {
  const metrics = readJSON(METRICS_FILE);
  metrics.push({
    id: Date.now(),
    video_id: videoId,
    platform,
    recorded_at: new Date().toISOString(),
    views,
    likes,
    comments,
    shares,
    engagement_rate: parseFloat(engagementRate.toFixed(2)),
  });

  // Mantiene solo últimos 10.000 registros
  if (metrics.length > 10000) metrics.splice(0, metrics.length - 10000);
  writeJSON(METRICS_FILE, metrics);
}

// ─────────────────────────────────────────────
//  POLLING
// ─────────────────────────────────────────────

async function pollAllMetrics() {
  logger.info('Starting metrics polling...');
  const videos = readJSON(VIDEOS_FILE).filter((v) => v.status === 'published');
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recent = videos.filter((v) => v.published_at > cutoff);

  for (const video of recent) {
    await Promise.allSettled([
      video.tiktok_id ? pollTikTokMetrics(video) : null,
      video.instagram_id ? pollInstagramMetrics(video) : null,
      video.youtube_id ? pollYouTubeMetrics(video) : null,
    ]);
  }
  logger.info(`Metrics polling done: ${recent.length} videos`);
}

async function pollTikTokMetrics(video) {
  try {
    const res = await axios.post(
      'https://open.tiktokapis.com/v2/video/query/',
      { filters: { video_ids: [video.tiktok_id] }, fields: ['id', 'view_count', 'like_count', 'comment_count', 'share_count'] },
      { headers: { Authorization: `Bearer ${process.env.TIKTOK_ACCESS_TOKEN}` }, timeout: 15000 }
    );
    const d = res.data?.data?.videos?.[0];
    if (!d) return;
    const er = d.view_count > 0 ? ((d.like_count + d.comment_count + d.share_count) / d.view_count) * 100 : 0;
    insertMetric({ videoId: video.id, platform: 'tiktok', views: d.view_count, likes: d.like_count, comments: d.comment_count, shares: d.share_count, engagementRate: er });
  } catch (err) {
    logger.error(`TikTok poll failed: ${err.message}`);
  }
}

async function pollInstagramMetrics(video) {
  try {
    const res = await axios.get(`https://graph.facebook.com/v19.0/${video.instagram_id}/insights`, {
      params: { metric: 'plays,likes,comments,shares,reach', access_token: process.env.INSTAGRAM_ACCESS_TOKEN },
      timeout: 15000,
    });
    const m = {};
    for (const item of res.data.data) m[item.name] = item.values?.[0]?.value || 0;
    const er = m.reach > 0 ? ((m.likes + m.comments + m.shares) / m.reach) * 100 : 0;
    insertMetric({ videoId: video.id, platform: 'instagram', views: m.plays || 0, likes: m.likes || 0, comments: m.comments || 0, shares: m.shares || 0, engagementRate: er });
  } catch (err) {
    logger.error(`Instagram poll failed: ${err.message}`);
  }
}

async function pollYouTubeMetrics(video) {
  try {
    const token = await refreshYouTubeToken();
    const res = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { id: video.youtube_id, part: 'statistics' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    const s = res.data.items?.[0]?.statistics;
    if (!s) return;
    const views = parseInt(s.viewCount || 0);
    const likes = parseInt(s.likeCount || 0);
    const comments = parseInt(s.commentCount || 0);
    const er = views > 0 ? ((likes + comments) / views) * 100 : 0;
    insertMetric({ videoId: video.id, platform: 'youtube', views, likes, comments, shares: 0, engagementRate: er });
  } catch (err) {
    logger.error(`YouTube poll failed: ${err.message}`);
  }
}

async function refreshYouTubeToken() {
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  return res.data.access_token;
}

// ─────────────────────────────────────────────
//  DASHBOARD STATS
// ─────────────────────────────────────────────

function getDashboardStats() {
  const videos = readJSON(VIDEOS_FILE);
  const metrics = readJSON(METRICS_FILE);

  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentMetrics = metrics.filter((m) => m.recorded_at > cutoff30);

  const totalViews = recentMetrics.reduce((s, m) => s + (m.views || 0), 0);
  const avgEngagement = recentMetrics.length
    ? recentMetrics.reduce((s, m) => s + (m.engagement_rate || 0), 0) / recentMetrics.length
    : 0;

  // Top videos por views máximos
  const videoMaxViews = {};
  for (const m of metrics) {
    if (!videoMaxViews[m.video_id] || m.views > videoMaxViews[m.video_id].views) {
      videoMaxViews[m.video_id] = m;
    }
  }

  const topVideos = videos
    .map((v) => ({ ...v, max_views: videoMaxViews[v.id]?.views || 0, max_engagement: videoMaxViews[v.id]?.engagement_rate || 0 }))
    .sort((a, b) => b.max_views - a.max_views)
    .slice(0, 5);

  // Métricas por plataforma y día (últimos 7 días)
  const recentByDay = metrics
    .filter((m) => m.recorded_at > cutoff7)
    .reduce((acc, m) => {
      const date = m.recorded_at.split('T')[0];
      const key = `${m.platform}_${date}`;
      if (!acc[key]) acc[key] = { platform: m.platform, date, views: 0, likes: 0 };
      acc[key].views += m.views || 0;
      acc[key].likes += m.likes || 0;
      return acc;
    }, {});

  return {
    totals: { total_videos: videos.length, total_views: totalViews, avg_engagement: avgEngagement.toFixed(2) },
    topVideos,
    recentMetrics: Object.values(recentByDay).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

module.exports = { initializeDatabase, saveVideo, pollAllMetrics, getDashboardStats };
