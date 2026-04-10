/**
 * voice-synthesizer.js
 * TTS GRATUITO usando Microsoft Edge TTS (msedge-tts).
 * Sin API key, sin coste. Calidad neural excelente en español.
 */

require('dotenv').config();
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DEFAULT_VOICE = process.env.EDGE_TTS_VOICE || 'es-ES-AlvaroNeural';

const SPANISH_VOICES = {
  'es-ES-AlvaroNeural':  { gender: 'Male',   locale: 'España' },
  'es-ES-ElviraNeural':  { gender: 'Female',  locale: 'España' },
  'es-MX-JorgeNeural':   { gender: 'Male',   locale: 'México' },
  'es-MX-DaliaNeural':   { gender: 'Female',  locale: 'México' },
  'es-AR-TomasNeural':   { gender: 'Male',   locale: 'Argentina' },
  'es-AR-ElenaNeural':   { gender: 'Female',  locale: 'Argentina' },
};

/**
 * Construye el texto con pausas dramáticas entre secciones.
 */
function buildText(script) {
  const { hook, claim, explanation, cta } = script;
  // Los puntos suspensivos crean pausa natural en Edge TTS
  return `${hook}... ${claim}. ${explanation}. ${cta}`;
}

/**
 * Sintetiza el guión completo y guarda el MP3.
 *
 * @param {Object} script  - Guión generado por content-generator
 * @param {string} outputPath - Ruta donde guardar el mp3
 * @returns {Object} { audioPath, estimatedDuration, wordCount }
 */
async function synthesizeVoice(script, outputPath) {
  const voice = DEFAULT_VOICE;
  const text = buildText(script);

  logger.info(`Edge TTS | Voice: ${voice} | chars: ${text.length}`);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  // Genera el audio y lo guarda directamente en disco
  const { audioStream } = await tts.toStream(text);

  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(outputPath);
    audioStream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    audioStream.on('error', reject);
  });

  const fileSize = fs.statSync(outputPath).size;
  if (fileSize < 1000) {
    throw new Error(`Edge TTS returned empty audio (${fileSize} bytes)`);
  }

  // Estima duración: ~140 palabras por minuto
  const wordCount = text.split(/\s+/).length;
  const estimatedDuration = parseFloat(((wordCount / 140) * 60).toFixed(2));

  logger.info(`Edge TTS: saved ${(fileSize / 1024).toFixed(0)} KB, ~${estimatedDuration}s`);

  return { audioPath: outputPath, estimatedDuration, wordCount };
}

function getSpanishVoices() {
  return Object.entries(SPANISH_VOICES).map(([name, info]) => ({ name, ...info, free: true }));
}

// ── Test directo ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const testScript = {
    hook: 'El 97% de las personas hace esto cuando miente.',
    claim: 'Un estudio de Harvard reveló 3 señales físicas que el cerebro emite de forma involuntaria.',
    explanation: 'La primera: tus ojos se mueven hacia arriba y a la derecha. Tu cerebro construye una imagen que no existe. La segunda: tocas tu cara, especialmente la nariz. El estrés dilata los capilares y crea picor. La tercera: tus expresiones aparecen un segundo tarde porque son forzadas.',
    cta: '¿Conocías estas señales? Comenta si has pillado a alguien con este truco.',
  };

  synthesizeVoice(testScript, './output/test_tts.mp3')
    .then((r) => console.log('✅ Audio generado:', r))
    .catch((e) => console.error('❌ Error:', e.message));
}

module.exports = { synthesizeVoice, getSpanishVoices, SPANISH_VOICES };
