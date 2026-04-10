/**
 * upload-youtube.js
 * Sube un video local a YouTube Shorts.
 * Uso: node scripts/upload-youtube.js <ruta_video> [ruta_script_json]
 *
 * Ejemplo:
 *   node scripts/upload-youtube.js output/test_ad0cf496/output.mp4 output/test_ad0cf496/script.json
 */

const path = require('path');
process.env.NODE_PATH = path.resolve(__dirname, '../backend/node_modules');
require('module').Module._initPaths();

require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const fs = require('fs');
const axios = require('axios');

const videoPath = process.argv[2];
const scriptPath = process.argv[3];

if (!videoPath || !fs.existsSync(videoPath)) {
  console.error('❌ Uso: node scripts/upload-youtube.js <ruta_video> [ruta_script.json]');
  console.error('   Ejemplo: node scripts/upload-youtube.js output/test_abc/output.mp4 output/test_abc/script.json');
  process.exit(1);
}

// Carga el guión si existe, si no usa defaults
let script = {
  hook: 'La gente inteligente nunca hace estas 4 cosas 🧠',
  topic: 'psychology',
  hashtags: ['#psicologia', '#mentalidad', '#cerebro'],
};

if (scriptPath && fs.existsSync(scriptPath)) {
  script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
  console.log(`📄 Guión cargado: ${script.title}`);
}

const BASE_HASHTAGS = '#psicologia #mentalidad #cerebro #hechosdepsicologia #psychology';
const caption = `${script.hook.toUpperCase()} 🧠\n\n${script.cta || '¿Lo sabías? Comenta 👇'}\n\n${BASE_HASHTAGS}`;

async function getAccessToken() {
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  return res.data.access_token;
}

async function upload() {
  console.log('\n📤 Subiendo a YouTube Shorts...');
  console.log(`   Video: ${videoPath}`);
  console.log(`   Título: ${script.hook?.slice(0, 80)}`);

  const videoBuffer = fs.readFileSync(videoPath);
  const videoSize = fs.statSync(videoPath).size;
  console.log(`   Tamaño: ${(videoSize / (1024 * 1024)).toFixed(1)} MB`);

  // 1. Obtener access token
  console.log('\n🔑 Obteniendo token de acceso...');
  const accessToken = await getAccessToken();
  console.log('   ✅ Token OK');

  // 2. Inicializar upload resumible
  console.log('\n📡 Iniciando upload resumible...');
  const initRes = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      snippet: {
        title: script.hook?.slice(0, 100) || 'Psychology Facts',
        description: caption,
        tags: ['psicologia', 'mentalidad', 'cerebro', 'psychology', 'shorts'],
        categoryId: '26',
        defaultLanguage: 'es',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': videoSize,
        'X-Upload-Content-Type': 'video/mp4',
      },
    }
  );

  const uploadUrl = initRes.headers.location;
  console.log('   ✅ Upload URL obtenida');

  // 3. Subir el archivo
  console.log('\n⬆️  Subiendo video...');
  const uploadRes = await axios.put(uploadUrl, videoBuffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': videoSize,
      Authorization: `Bearer ${accessToken}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 300000,
    onUploadProgress: (p) => {
      const pct = Math.round((p.loaded / p.total) * 100);
      process.stdout.write(`\r   Progreso: ${pct}%`);
    },
  });

  const videoId = uploadRes.data.id;
  console.log(`\n\n✅ ¡Publicado en YouTube Shorts!`);
  console.log(`   ID: ${videoId}`);
  console.log(`   URL: https://www.youtube.com/shorts/${videoId}`);
  console.log(`   URL alternativa: https://youtube.com/watch?v=${videoId}\n`);

  return videoId;
}

upload().catch((err) => {
  console.error('\n❌ Error:', err.response?.data?.error?.message || err.message);
  if (err.response?.data) console.error('   Detalle:', JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});
