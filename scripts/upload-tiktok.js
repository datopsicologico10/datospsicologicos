/**
 * upload-tiktok.js
 * Sube un vídeo a TikTok usando el Content Posting API (Direct Post).
 * Uso: node scripts/upload-tiktok.js <ruta_video> [ruta_script.json]
 */

const path = require('path');
process.env.NODE_PATH = path.resolve(__dirname, '../backend/node_modules');
require('module').Module._initPaths();
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const fs   = require('fs');
const axios = require('axios');

const videoPath  = process.argv[2];
const scriptPath = process.argv[3];

if (!videoPath || !fs.existsSync(videoPath)) {
  console.error('❌ Uso: node scripts/upload-tiktok.js <ruta_video> [ruta_script.json]');
  process.exit(1);
}

let script = { hook: 'Dato psicológico increíble que debes conocer', hashtags: [] };
if (scriptPath && fs.existsSync(scriptPath)) {
  script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
}

const BASE_HASHTAGS = '#psicologia #mentalidad #cerebro #hechosdepsicologia #shorts';
const title = (script.hook || '').slice(0, 150);

async function refreshAccessToken() {
  const res = await axios.post(
    'https://open.tiktokapis.com/v2/oauth/token/',
    new URLSearchParams({
      client_key:    process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: process.env.TIKTOK_REFRESH_TOKEN,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, refresh_token } = res.data;

  // Actualiza tokens en .env
  const envPath = path.resolve(__dirname, '../backend/.env');
  let env = fs.readFileSync(envPath, 'utf8');
  env = env.replace(/TIKTOK_ACCESS_TOKEN=.*/, `TIKTOK_ACCESS_TOKEN=${access_token}`);
  env = env.replace(/TIKTOK_REFRESH_TOKEN=.*/, `TIKTOK_REFRESH_TOKEN=${refresh_token}`);
  fs.writeFileSync(envPath, env);

  return access_token;
}

async function upload() {
  const videoSize = fs.statSync(videoPath).size;
  console.log(`\n📤 Subiendo a TikTok...`);
  console.log(`   Video: ${videoPath}`);
  console.log(`   Título: ${title}`);
  console.log(`   Tamaño: ${(videoSize / (1024 * 1024)).toFixed(1)} MB`);

  let accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken || accessToken === 'RELLENAR') {
    console.error('❌ Falta TIKTOK_ACCESS_TOKEN. Ejecuta primero: node scripts/auth-tiktok.js');
    process.exit(1);
  }

  // Refresca el token por si ha caducado
  try {
    console.log('\n🔄 Refrescando access token...');
    accessToken = await refreshAccessToken();
    console.log('   ✅ Token actualizado');
  } catch {
    console.log('   ℹ️  Usando token actual');
  }

  // 1. Inicializar upload (chunk único)
  console.log('\n📡 Inicializando upload...');
  const initRes = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      post_info: {
        title,
        privacy_level:  'PUBLIC_TO_EVERYONE',
        disable_duet:   false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source:            'FILE_UPLOAD',
        video_size:        videoSize,
        chunk_size:        videoSize,
        total_chunk_count: 1,
      },
    },
    {
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    }
  );

  const { publish_id, upload_url } = initRes.data.data;
  console.log(`   ✅ publish_id: ${publish_id}`);

  // 2. Subir el archivo
  console.log('\n⬆️  Subiendo vídeo...');
  const videoBuffer = fs.readFileSync(videoPath);
  await axios.put(upload_url, videoBuffer, {
    headers: {
      'Content-Type':  'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      'Content-Length': videoSize,
    },
    maxBodyLength:    Infinity,
    maxContentLength: Infinity,
    timeout:          300000,
    onUploadProgress: (p) => {
      if (p.total) process.stdout.write(`\r   Progreso: ${Math.round((p.loaded / p.total) * 100)}%`);
    },
  });

  // 3. Verificar estado
  console.log('\n\n🔍 Verificando estado...');
  await new Promise((r) => setTimeout(r, 3000));
  const statusRes = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
    { publish_id },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );

  const status = statusRes.data.data?.status;
  console.log(`   Estado: ${status}`);

  if (status === 'PUBLISH_COMPLETE') {
    console.log('\n✅ ¡Publicado en TikTok!');
  } else if (status === 'PROCESSING_UPLOAD' || status === 'SEND_TO_USER_INBOX') {
    console.log('\n✅ Vídeo subido — procesando en TikTok (puede tardar unos minutos)');
  } else {
    console.log('\n⚠️  Estado inesperado:', statusRes.data);
  }
}

upload().catch((err) => {
  console.error('\n❌ Error:', err.response?.data || err.message);
  process.exit(1);
});
