/**
 * video-renderer.js
 * Renderer mejorado:
 * - ffprobe para duración REAL del audio (sync perfecto)
 * - Pexels API para stock footage de fondo (gratis)
 * - Subtítulos por secciones sincronizados al audio real
 * - Overlay oscuro + texto grande y legible
 */

require('dotenv').config();
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const themes = require('../templates/visual-themes.json');
const W = 1080;
const H = 1920;

// Carpeta de caché para vídeos de Pexels descargados
const CACHE_DIR = path.resolve('./assets/stock-footage');

// Palabras clave de búsqueda en Pexels por topic
const TOPIC_QUERIES = {
  body_language:    'people talking conversation',
  cognitive_biases: 'brain thinking mind abstract',
  relationships:    'people friends couple connection',
  workplace:        'office work professional meeting',
  first_impressions:'handshake meeting people confidence',
  social_skills:    'social people networking smiling',
  habits:           'morning routine motivation success',
  communication:    'people conversation talking listen',
};

// ─────────────────────────────────────────────
//  FFPROBE — duración real del audio
// ─────────────────────────────────────────────

function getRealAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(parseFloat(metadata.format.duration));
    });
  });
}

// ─────────────────────────────────────────────
//  PEXELS — descarga vídeo de fondo
// ─────────────────────────────────────────────

// Construye query de Pexels combinando keywords del guión + fallback por topic
function buildPexelsQuery(script) {
  const keywords = (script.keywords || []).slice(0, 3);
  if (keywords.length >= 2) return keywords.join(' ');
  return TOPIC_QUERIES[script.topic] || 'psychology mind brain';
}

async function getPexelsVideo(script) {
  if (!process.env.PEXELS_API_KEY || process.env.PEXELS_API_KEY === 'RELLENAR') {
    logger.warn('PEXELS_API_KEY no configurada — usando fondo animado');
    return null;
  }

  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  const query = buildPexelsQuery(script);
  // Página aleatoria (1-4) para variar resultados en cada render
  const page = Math.floor(Math.random() * 4) + 1;

  try {
    logger.info(`Fetching Pexels video | query: "${query}" | page: ${page}`);
    const res = await axios.get('https://api.pexels.com/videos/search', {
      headers: { Authorization: process.env.PEXELS_API_KEY },
      params: { query, per_page: 10, page, orientation: 'portrait', size: 'medium' },
      timeout: 15000,
    });

    const videos = (res.data.videos || []).filter((v) => v.duration >= 10);

    // Si no hay resultados con las keywords, reintenta con el query genérico del topic
    if (!videos.length) {
      logger.warn(`No results for "${query}", falling back to topic query`);
      const fallback = await axios.get('https://api.pexels.com/videos/search', {
        headers: { Authorization: process.env.PEXELS_API_KEY },
        params: { query: TOPIC_QUERIES[script.topic] || 'psychology mind', per_page: 10, orientation: 'portrait' },
        timeout: 15000,
      });
      videos.push(...(fallback.data.videos || []).filter((v) => v.duration >= 10));
    }

    if (!videos.length) return null;

    // Elige un vídeo aleatorio de los resultados
    const chosen = videos[Math.floor(Math.random() * videos.length)];
    const file = chosen.video_files
      .filter((f) => f.file_type === 'video/mp4')
      .sort((a, b) => b.height - a.height)[0];

    if (!file?.link) return null;

    // Cachea por ID de Pexels — nunca descarga el mismo vídeo dos veces
    const cachedPath = path.join(CACHE_DIR, `pexels_${chosen.id}.mp4`);
    if (fs.existsSync(cachedPath)) {
      logger.info(`Using cached Pexels video: pexels_${chosen.id}.mp4`);
      return cachedPath;
    }

    logger.info(`Downloading Pexels video ${chosen.id}: "${query}" p${page}`);
    const writer = fs.createWriteStream(cachedPath);
    const download = await axios.get(file.link, { responseType: 'stream', timeout: 60000 });
    download.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    logger.info(`Saved: pexels_${chosen.id}.mp4`);
    return cachedPath;
  } catch (err) {
    logger.error(`Pexels fetch failed: ${err.message}`);
    // Último recurso: usa cualquier vídeo ya cacheado
    const anycached = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.mp4'));
    if (anycached.length) {
      const pick = anycached[Math.floor(Math.random() * anycached.length)];
      logger.warn(`Fallback to cached: ${pick}`);
      return path.join(CACHE_DIR, pick);
    }
    return null;
  }
}

// ─────────────────────────────────────────────
//  SUBTÍTULOS — basados en duración REAL
// ─────────────────────────────────────────────

/**
 * Divide cada sección del guión en bloques cortos (máx 5 palabras)
 * y les asigna timing proporcional a la duración real del audio.
 */
function buildSubtitleBlocks(script, realDuration) {
  // Proporciones de tiempo por sección (basadas en velocidad de lectura)
  const sections = [
    { key: 'hook',        ratio: 0.10 },
    { key: 'claim',       ratio: 0.22 },
    { key: 'explanation', ratio: 0.48 },
    { key: 'cta',         ratio: 0.20 },
  ];

  const blocks = [];
  let currentTime = 0;

  for (const section of sections) {
    const text = (script[section.key] || '').trim();
    if (!text) continue;

    const sectionDuration = realDuration * section.ratio;
    const words = text.split(/\s+/);
    const WORDS_PER_BLOCK = 4;
    const numBlocks = Math.ceil(words.length / WORDS_PER_BLOCK);
    const blockDuration = sectionDuration / numBlocks;

    for (let i = 0; i < numBlocks; i++) {
      const chunk = words.slice(i * WORDS_PER_BLOCK, (i + 1) * WORDS_PER_BLOCK).join(' ');
      blocks.push({
        text: chunk,
        start: parseFloat(currentTime.toFixed(3)),
        end: parseFloat((currentTime + blockDuration).toFixed(3)),
        isHook: section.key === 'hook',
      });
      currentTime += blockDuration;
    }
  }

  return blocks;
}

function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\u2019')
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,');
}

function buildDrawtextFilters(blocks) {
  const fontDir = path.resolve('./assets/fonts');
  const fontFile = path.join(fontDir, 'Montserrat-Bold.ttf');
  const hasFont = fs.existsSync(fontFile);

  return blocks.map((block) => {
    const t = `between(t,${block.start},${block.end})`;
    const fontSize = block.isHook ? 82 : 72;
    const color = block.isHook ? 'yellow' : 'white';
    const fontPart = hasFont
      ? `fontfile='${fontFile.replace(/\\/g, '/')}':fontsize=${fontSize}`
      : `fontsize=${fontSize}`;

    return (
      `drawtext=${fontPart}:` +
      `text='${escapeDrawtext(block.text)}':` +
      `fontcolor=${color}:` +
      `bordercolor=black:borderw=5:` +
      `x=(w-text_w)/2:y=h*0.72:` +
      `box=1:boxcolor=black@0.5:boxborderw=14:` +
      `enable='${t}'`
    );
  }).join(',');
}

// ─────────────────────────────────────────────
//  RENDER PRINCIPAL
// ─────────────────────────────────────────────

async function renderVideo({ script, audioPath, audioDuration, outputPath, themeId }) {
  const theme = themes.themes.find((t) => t.id === themeId) || themes.themes[0];
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // 1. Duración REAL del audio (no estimada)
  const realDuration = await getRealAudioDuration(audioPath);
  logger.info(`Real audio duration: ${realDuration.toFixed(2)}s (estimated was ${audioDuration}s)`);

  // 2. Intenta conseguir vídeo de fondo de Pexels (basado en keywords del guión)
  const bgVideo = await getPexelsVideo(script);

  // 3. Construye bloques de subtítulos sincronizados al audio real
  const blocks = buildSubtitleBlocks(script, realDuration);
  const drawtextFilter = buildDrawtextFilters(blocks);

  logger.info(`Rendering | Theme: ${theme.name} | Background: ${bgVideo ? 'Pexels' : 'gradient'} | Subtitles: ${blocks.length} blocks`);

  // 4. Música de fondo
  const musicDir = path.resolve('./assets/music');
  let musicPath = null;
  if (fs.existsSync(musicDir)) {
    const tracks = fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|aac)$/i.test(f));
    if (tracks.length) musicPath = path.join(musicDir, tracks[Math.floor(Math.random() * tracks.length)]);
  }

  // 5. Logo watermark
  const logoPath = path.resolve('./assets/logo_dato_psicologico.png');
  const hasLogo = fs.existsSync(logoPath);

  // 6. Renderiza
  if (bgVideo) {
    return renderWithPexelsBg({ bgVideo, audioPath, musicPath, realDuration, drawtextFilter, outputPath, theme, logoPath: hasLogo ? logoPath : null });
  } else {
    return renderWithGradientBg({ audioPath, musicPath, realDuration, drawtextFilter, outputPath, theme, logoPath: hasLogo ? logoPath : null });
  }
}

// ─── Con vídeo de Pexels ──────────────────────────────────────────────────────

function renderWithPexelsBg({ bgVideo, audioPath, musicPath, realDuration, drawtextFilter, outputPath, theme, logoPath }) {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();

    // Input 0: vídeo de fondo Pexels
    cmd = cmd.input(bgVideo).inputOptions(['-stream_loop -1', `-t ${realDuration}`]);
    // Input 1: voz
    cmd = cmd.input(audioPath);
    // Input 2: música (opcional)
    const hasMuisc = musicPath && fs.existsSync(musicPath);
    if (hasMuisc) cmd = cmd.input(musicPath);
    // Input 2 o 3: logo watermark (opcional)
    if (logoPath) cmd = cmd.input(logoPath);
    const logoIdx = hasMuisc ? 3 : 2;

    // Pipeline de vídeo:
    // 1. Escala y recorta el vídeo a 9:16 (1080x1920)
    // 2. Oscurece para legibilidad
    // 3. Overlay del logo watermark (esquina superior derecha, 70% opacidad)
    // 4. Subtítulos encima
    let videoFilter =
      `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,` +
      `crop=${W}:${H},` +
      `fps=30[scaled];` +
      `[scaled]colorchannelmixer=rr=0.4:gg=0.4:bb=0.4[darkened];`;

    if (logoPath) {
      videoFilter +=
        `[${logoIdx}:v]scale=180:-1,format=rgba,colorchannelmixer=aa=0.7[wm];` +
        `[darkened][wm]overlay=W-w-24:24[branded];` +
        `[branded]${drawtextFilter}[vout]`;
    } else {
      videoFilter += `[darkened]${drawtextFilter}[vout]`;
    }

    let audioFilter = '';
    if (hasMuisc) {
      audioFilter =
        `;[2:a]volume=0.15,` +
        `afade=t=in:st=0:d=1,` +
        `afade=t=out:st=${Math.max(0, realDuration - 2)}:d=2[music];` +
        `[1:a][music]amix=inputs=2:duration=first:normalize=0[aout]`;
    }

    cmd
      .complexFilter(videoFilter + audioFilter)
      .outputOptions([
        '-map [vout]',
        hasMuisc ? '-map [aout]' : '-map 1:a',
        '-c:v libx264', '-preset fast', '-crf 22',
        '-pix_fmt yuv420p', '-r 30',
        '-c:a aac', '-b:a 192k', '-ar 44100',
        `-t ${realDuration}`, '-movflags +faststart',
      ])
      .output(outputPath)
      .on('start', (c) => logger.debug(`FFmpeg: ${c.slice(0, 100)}...`))
      .on('progress', (p) => p.percent && logger.debug(`FFmpeg: ${p.percent.toFixed(0)}%`))
      .on('end', () => { logger.info(`Video rendered: ${outputPath}`); resolve(outputPath); })
      .on('error', (err, _s, stderr) => {
        logger.error(`FFmpeg error: ${err.message}`);
        if (stderr) logger.error(stderr.slice(-800));
        reject(err);
      })
      .run();
  });
}

// ─── Con fondo animado (sin Pexels) ──────────────────────────────────────────

function renderWithGradientBg({ audioPath, musicPath, realDuration, drawtextFilter, outputPath, theme, logoPath }) {
  return new Promise((resolve, reject) => {
    const c1 = hexToRgb(theme.background.colors[0]);
    const c2 = hexToRgb(theme.background.colors[theme.background.colors.length - 1]);

    // Gradiente animado — pulso suave de luminosidad
    const rExpr = `lerp(${c1.r},${c2.r},Y/H)+15*sin(2*PI*T/4)`;
    const gExpr = `lerp(${c1.g},${c2.g},Y/H)+10*sin(2*PI*T/4)`;
    const bExpr = `lerp(${c1.b},${c2.b},Y/H)+20*sin(2*PI*T/3)`;

    const hasMuisc = musicPath && fs.existsSync(musicPath);
    let cmd = ffmpeg();

    cmd = cmd
      .input(`color=black:s=${W}x${H}:r=30`)
      .inputFormat('lavfi')
      .inputOptions([`-t ${realDuration}`]);
    cmd = cmd.input(audioPath);
    if (hasMuisc) cmd = cmd.input(musicPath);
    if (logoPath) cmd = cmd.input(logoPath);
    const logoIdx = hasMuisc ? 3 : 2;

    let videoFilter =
      `[0:v]geq=r='${rExpr}':g='${gExpr}':b='${bExpr}'[bg];`;

    if (logoPath) {
      videoFilter +=
        `[${logoIdx}:v]scale=180:-1,format=rgba,colorchannelmixer=aa=0.7[wm];` +
        `[bg][wm]overlay=W-w-24:24[branded];` +
        `[branded]${drawtextFilter}[vout]`;
    } else {
      videoFilter += `[bg]${drawtextFilter}[vout]`;
    }

    let audioFilter = '';
    if (hasMuisc) {
      audioFilter =
        `;[2:a]volume=0.15,` +
        `afade=t=in:st=0:d=1,` +
        `afade=t=out:st=${Math.max(0, realDuration - 2)}:d=2[music];` +
        `[1:a][music]amix=inputs=2:duration=first:normalize=0[aout]`;
    }

    cmd
      .complexFilter(videoFilter + audioFilter)
      .outputOptions([
        '-map [vout]',
        hasMuisc ? '-map [aout]' : '-map 1:a',
        '-c:v libx264', '-preset fast', '-crf 22',
        '-pix_fmt yuv420p', '-r 30',
        '-c:a aac', '-b:a 192k', '-ar 44100',
        `-t ${realDuration}`, '-movflags +faststart',
      ])
      .output(outputPath)
      .on('start', (c) => logger.debug(`FFmpeg: ${c.slice(0, 100)}...`))
      .on('progress', (p) => p.percent && logger.debug(`FFmpeg: ${p.percent.toFixed(0)}%`))
      .on('end', () => { logger.info(`Video rendered: ${outputPath}`); resolve(outputPath); })
      .on('error', (err, _s, stderr) => {
        logger.error(`FFmpeg error: ${err.message}`);
        if (stderr) logger.error(stderr.slice(-800));
        reject(err);
      })
      .run();
  });
}

function hexToRgb(hex) {
  const n = parseInt((hex || '#0a0a1a').replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

module.exports = { renderVideo, getRealAudioDuration };
