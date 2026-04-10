/**
 * download-music.js
 * Descarga pistas de música royalty-free desde Pixabay para usar
 * como fondo en los vídeos. Totalmente gratis y legal.
 *
 * Uso: node scripts/download-music.js
 *
 * Requiere PIXABAY_API_KEY en backend/.env
 * Obtén la key gratis en: https://pixabay.com/api/docs/
 */

const path = require('path');
process.env.NODE_PATH = path.resolve(__dirname, '../backend/node_modules');
require('module').Module._initPaths();
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const axios = require('axios');
const fs = require('fs');

const MUSIC_DIR = path.resolve(__dirname, '../assets/music');
const API_KEY = process.env.PIXABAY_API_KEY;

// Queries de búsqueda para música ambiental
const QUERIES = [
  'ambient background calm',
  'cinematic dramatic tension',
  'inspiring motivational upbeat',
  'dark mysterious suspense',
  'focus concentration study',
];

async function downloadTrack(url, filename) {
  const dest = path.join(MUSIC_DIR, filename);
  if (fs.existsSync(dest)) {
    console.log(`  ⏭  Ya existe: ${filename}`);
    return;
  }
  console.log(`  ⬇️  Descargando: ${filename}`);
  const res = await axios.get(url, { responseType: 'stream', timeout: 60000 });
  const writer = fs.createWriteStream(dest);
  res.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  console.log(`  ✅ Guardado: ${filename}`);
}

async function main() {
  if (!API_KEY || API_KEY === 'RELLENAR') {
    console.log('\n⚠️  Falta PIXABAY_API_KEY en backend/.env');
    console.log('   Obtén tu clave gratis en: https://pixabay.com/api/docs/\n');
    console.log('   Añade al .env:');
    console.log('   PIXABAY_API_KEY=tu_key_aqui\n');
    process.exit(0);
  }

  if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });

  console.log('\n🎵 Descargando música de fondo royalty-free (Pixabay)...\n');
  let total = 0;

  for (const query of QUERIES) {
    try {
      console.log(`🔍 Buscando: "${query}"`);
      const res = await axios.get('https://pixabay.com/api/videos/music/', {
        params: { key: API_KEY, q: query, per_page: 3 },
        timeout: 10000,
      });

      const hits = res.data.hits || [];
      if (!hits.length) { console.log('  Sin resultados\n'); continue; }

      for (const track of hits.slice(0, 2)) {
        const url = track.audio;
        if (!url) continue;
        const slug = query.replace(/\s+/g, '_').slice(0, 20);
        const filename = `${slug}_${track.id}.mp3`;
        await downloadTrack(url, filename);
        total++;
      }
      console.log('');
    } catch (err) {
      console.error(`  Error en "${query}": ${err.message}`);
    }
  }

  console.log(`\n✅ ${total} pistas descargadas en assets/music/`);
  console.log('   Se usarán automáticamente como fondo en los vídeos.\n');
}

main();
