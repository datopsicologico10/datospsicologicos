/**
 * content-generator.js
 * Genera guiones virales con Claude.
 * Proceso interno en una sola llamada:
 *   1. Analiza y selecciona los datos psicológicos con mayor potencial viral
 *   2. Construye el guión optimizado sobre el dato elegido
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { scoreScript } = require('../utils/virality-scorer');
const hooksData = require('../templates/psychology-hooks.json');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un experto en psicología, comportamiento humano y contenido viral para redes sociales (TikTok, YouTube Shorts e Instagram Reels) en español.

════════════════════════════════════════
FASE 1 — SELECCIÓN INTERNA (no la muestres en el output)
════════════════════════════════════════
Antes de escribir el guión, analiza mentalmente 3-5 posibles datos psicológicos para el tema recibido y selecciona el que tenga MAYOR potencial viral según estos criterios:

PRIORIDAD MÁXIMA:
• Contraintuitivo o sorprendente ("¿Esto es real?")
• Genera identificación emocional inmediata
• Relacionado con relaciones, hábitos, mente o comportamiento cotidiano
• Se entiende en menos de 10 segundos
• Puede generar debate, sorpresa extrema o ligera controversia sin violar normas

DESCARTAR si:
• Es demasiado técnico o requiere conocimientos previos
• No genera reacción emocional inmediata
• Ya es muy conocido por el público general

════════════════════════════════════════
FASE 2 — GUIÓN (lo que debes devolver)
════════════════════════════════════════
Con el dato seleccionado, escribe un guión optimizado para máxima retención.

ESTRUCTURA OBLIGATORIA:
• HOOK (0-2s): Impacto inmediato. SIEMPRE empieza con número ("3 señales que..."), "Nunca", "El X% de", "La gente inteligente" o pregunta directa con "¿". Debe hacer que el usuario pare el scroll.
• CLAIM (2-8s): El dato psicológico sorprendente. Concreto, directo, con estudio o cifra real (puede simplificarse).
• EXPLANATION (8-45s): Desarrolla el dato. Conecta con la vida cotidiana del espectador. Usa "tú" y "tu". Frases cortas, ritmo dinámico.
• CTA (45-58s): Cierre con pregunta que invite a comentar. Ejemplo: "¿Te ha pasado?", "¿Lo sabías?", "Comenta qué piensas 👇"

PALABRAS DE IMPACTO (usa al menos 2):
nunca, jamás, siempre, secreto, descubre, revela, manipulando, tóxico, increíble, estudio, comprobado, real, oculta, alerta, inmediatamente

CUENTA DE PALABRAS — OBLIGATORIO:
• HOOK: 15-20 palabras
• CLAIM: 20-30 palabras
• EXPLANATION: 60-75 palabras
• CTA: 15-20 palabras
• TOTAL: entre 120 y 135 palabras (para 55-60 segundos exactos)

TONO: Impactante, directo y emocional. Estilo narrador TikTok viral. Lenguaje sencillo, nivel usuario promedio.

════════════════════════════════════════
FORMATO DE RESPUESTA — JSON puro, sin markdown, sin texto extra
════════════════════════════════════════
{
  "title": "slug_identificador_interno",
  "topic": "body_language|cognitive_biases|relationships|workplace|first_impressions|social_skills|habits|communication|emotions|memory|motivation|dark_psychology|self_esteem",
  "hook": "texto hook (15-20 palabras)",
  "claim": "texto claim (20-30 palabras)",
  "explanation": "texto explicación (60-75 palabras)",
  "cta": "texto CTA (15-20 palabras, termina con pregunta)",
  "psychologicalFact": "el dato psicológico central en una frase",
  "viralTrigger": "sorpresa|identificacion|controversia|utilidad|miedo",
  "durationSeconds": 58,
  "keywords": ["keyword_visual_1", "keyword_visual_2", "keyword_visual_3"],
  "emotionalTrigger": "curiosity|fear|awe|validation|urgency",
  "hashtags": ["#psicologia", "#mentalidad", "#cerebro", "#hechos", "#viral"]
}`;

function selectHook(topic = null) {
  const hooks = topic
    ? hooksData.hooks.filter((h) => h.topic === topic)
    : hooksData.hooks;
  return hooks[Math.floor(Math.random() * hooks.length)];
}

async function generateScript(options = {}) {
  const { topic, hookId } = options;

  const baseHook = hookId
    ? hooksData.hooks.find((h) => h.id === hookId)
    : selectHook(topic);

  logger.info(`Generating script | Topic: ${baseHook?.topic} | Hook: ${baseHook?.id}`);

  const userPrompt = `Tema: ${baseHook?.topic || topic || 'psychology'}
Hook de referencia (puedes adaptarlo o mejorarlo): "${baseHook?.text}"

Recuerda el proceso:
1. Analiza internamente qué dato psicológico de este tema tiene más potencial viral ahora mismo
2. Selecciona el más sorprendente, contraintuitivo o que genere más identificación
3. Construye el guión completo sobre ese dato

OBLIGATORIO: entre 120 y 135 palabras en total. El vídeo debe durar exactamente ~58 segundos.`;

  try {
    logger.debug('Claude API call');

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = message.content[0].text.trim();
    const jsonText = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const script = JSON.parse(jsonText);

    validateScriptFields(script);

    const viralityResult = scoreScript(script);
    script.viralityScore = viralityResult.score;
    script.viralityBreakdown = viralityResult.breakdown;
    script.approved = viralityResult.approved;

    const totalWords = [script.hook, script.claim, script.explanation, script.cta]
      .join(' ').split(/\s+/).length;
    script.estimatedWords = totalWords;
    script.durationSeconds = Math.round((totalWords / 140) * 60);

    logger.info(`Script OK | words=${totalWords} | duration=${script.durationSeconds}s | score=${viralityResult.score} | trigger=${script.viralTrigger}`);
    return script;

  } catch (err) {
    logger.error(`Script generation failed: ${err.message}`);
    throw err;
  }
}

async function generateBatch(count = 3) {
  const topics = hooksData.topics;
  const scripts = [];

  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length];
    try {
      const script = await generateScript({ topic });
      scripts.push(script);
      logger.info(`Batch ${i + 1}/${count}: ${script.title}`);
      if (i < count - 1) await sleep(2000);
    } catch (err) {
      logger.error(`Batch item ${i + 1} failed: ${err.message}`);
    }
  }

  return scripts;
}

function validateScriptFields(script) {
  for (const field of ['hook', 'claim', 'explanation', 'cta', 'topic']) {
    if (!script[field]) throw new Error(`Missing field: ${field}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { generateScript, generateBatch };
