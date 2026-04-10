/**
 * analyze-patterns.js
 * Envía los datos de viral-research.json a Claude para extraer patrones
 * accionables y actualiza automáticamente:
 *   - backend/src/services/content-generator.js  (INSIGHTS en el system prompt)
 *   - backend/src/templates/psychology-hooks.json (nuevos hooks basados en datos reales)
 *   - backend/data/insights.json                  (reporte completo para referencia)
 *
 * Uso: node scripts/analyze-patterns.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RESEARCH_PATH = path.join(__dirname, '../backend/data/viral-research.json');
const INSIGHTS_PATH = path.join(__dirname, '../backend/data/insights.json');
const HOOKS_PATH = path.join(__dirname, '../backend/src/templates/psychology-hooks.json');
const GENERATOR_PATH = path.join(__dirname, '../backend/src/services/content-generator.js');

// ─────────────────────────────────────────────
//  1. ANÁLISIS GENERAL DE PATRONES
// ─────────────────────────────────────────────

async function analyzePatterns(research) {
  console.log('🧠  Claude analizando patrones de viralidad...');

  const { summary, hookPatternPerformance, durationPerformance, topWords, top20Videos } = research;

  const prompt = `Eres un experto en contenido viral de psicología en español para TikTok/YouTube Shorts. Analiza estos datos reales de los vídeos más virales y extrae insights accionables.

## DATOS DE LA INVESTIGACIÓN
- Vídeos analizados: ${summary.totalVideosAnalyzed}
- Período: ${summary.dateRange.from} a ${summary.dateRange.to}
- Vistas promedio: ${summary.avgViews.toLocaleString()}
- Engagement promedio: ${summary.avgEngagement}%

## RENDIMIENTO POR PATRÓN DE HOOK
${JSON.stringify(hookPatternPerformance, null, 2)}

## ENGAGEMENT POR DURACIÓN
${JSON.stringify(durationPerformance.avgEngagementByBucket, null, 2)}
Distribución: ${JSON.stringify(durationPerformance.distribution, null, 2)}

## TOP 40 PALABRAS EN TÍTULOS VIRALES
${topWords.map((w) => `"${w.word}" (×${w.count})`).join(', ')}

## TOP 20 VÍDEOS MÁS VIRALES
${top20Videos.map((v, i) =>
  `${i + 1}. [${v.views.toLocaleString()} views | ${v.engagementRate}% eng | ${v.durationSec}s | ${v.hookPattern}]\n   "${v.title}"`
).join('\n')}

## TAREA
Responde en JSON puro, sin markdown. El JSON debe tener exactamente esta estructura:

{
  "keyFindings": [
    "hallazgo concreto 1 con dato numérico",
    "hallazgo concreto 2 con dato numérico",
    "hallazgo concreto 3 con dato numérico",
    "hallazgo concreto 4 con dato numérico",
    "hallazgo concreto 5 con dato numérico"
  ],
  "bestHookPatterns": [
    {
      "pattern": "nombre del patrón",
      "explanation": "por qué funciona",
      "template": "plantilla con [TEMA] o [NÚMERO]",
      "example": "ejemplo concreto"
    }
  ],
  "wordsToAvoid": ["palabra1", "palabra2"],
  "powerWords": ["palabra de alto impacto 1", "palabra de alto impacto 2"],
  "optimalDuration": {
    "seconds": 58,
    "reasoning": "por qué esta duración"
  },
  "topicsRanking": [
    { "topic": "nombre", "reason": "por qué está en esta posición" }
  ],
  "promptImprovements": "párrafo de 3-5 frases con mejoras específicas al sistema prompt de generación de contenido basadas en los datos. Debe ser directamente usable como instrucción adicional para Claude.",
  "newHookSuggestions": [
    {
      "text": "texto del hook en español",
      "topic": "body_language|cognitive_biases|relationships|workplace|first_impressions|social_skills|habits|communication|emotions|memory|motivation|dark_psychology|self_esteem",
      "emotionalTrigger": "curiosity|fear|awe|validation|urgency|controversy",
      "estimatedScore": 85,
      "basedOn": "qué vídeo viral inspiró este hook"
    }
  ]
}`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(raw);
}

// ─────────────────────────────────────────────
//  2. ANÁLISIS DE TÍTULOS — ESTRUCTURA LINGÜÍSTICA
// ─────────────────────────────────────────────

async function analyzeTitleStructure(top20Videos) {
  console.log('🔤  Analizando estructura lingüística de títulos...');

  const titles = top20Videos.map((v, i) =>
    `${i + 1}. [${v.views.toLocaleString()} views] "${v.title}"`
  ).join('\n');

  const prompt = `Analiza los títulos de los 20 vídeos de psicología más virales en español. Identifica patrones lingüísticos precisos.

${titles}

Responde en JSON puro:
{
  "openingFormulas": [
    { "formula": "cómo empieza", "frequency": 5, "example": "ejemplo real" }
  ],
  "numberUsage": {
    "percentage": 60,
    "insight": "qué tipo de números funcionan más"
  },
  "emotionalWordPatterns": [
    { "word": "nunca", "context": "cuándo y cómo se usa", "impact": "alto|medio|bajo" }
  ],
  "questionVsStatement": {
    "questions": 30,
    "statements": 70,
    "bestPerforming": "questions|statements",
    "insight": "por qué"
  },
  "avgTitleLength": {
    "words": 9,
    "insight": "qué longitud funciona mejor"
  },
  "forbiddenPhrases": ["frases que NO aparecen en vídeos virales"],
  "mustHaveElements": ["elementos que casi siempre están presentes"]
}`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(raw);
}

// ─────────────────────────────────────────────
//  3. ACTUALIZAR PSYCHOLOGY-HOOKS.JSON
// ─────────────────────────────────────────────

function updateHooksFile(insights) {
  const hooksData = JSON.parse(fs.readFileSync(HOOKS_PATH, 'utf8'));
  const existing = new Set(hooksData.hooks.map((h) => h.text.toLowerCase()));

  const newHooks = (insights.newHookSuggestions || [])
    .filter((h) => !existing.has(h.text.toLowerCase()))
    .map((h, i) => ({
      id: `hook_ai_${String(hooksData.hooks.length + i + 1).padStart(3, '0')}`,
      text: h.text,
      topic: h.topic,
      emotionalTrigger: h.emotionalTrigger,
      estimatedScore: h.estimatedScore,
      source: 'viral_research',
      basedOn: h.basedOn,
    }));

  if (newHooks.length > 0) {
    hooksData.hooks.push(...newHooks);
    fs.writeFileSync(HOOKS_PATH, JSON.stringify(hooksData, null, 2));
    console.log(`✅  Añadidos ${newHooks.length} nuevos hooks basados en datos reales`);
  } else {
    console.log('ℹ️   Sin hooks nuevos que añadir (ya existen o no hay sugerencias)');
  }

  return newHooks.length;
}

// ─────────────────────────────────────────────
//  4. ACTUALIZAR CONTENT-GENERATOR.JS
// ─────────────────────────────────────────────

function updateContentGenerator(insights, titleAnalysis) {
  const content = fs.readFileSync(GENERATOR_PATH, 'utf8');

  // Construye el bloque de insights dinámico
  const powerWords = (insights.powerWords || []).slice(0, 12).join(', ');
  const avoidWords = (insights.wordsToAvoid || []).join(', ');
  const topPatterns = (insights.bestHookPatterns || [])
    .slice(0, 3)
    .map((p) => `  • ${p.pattern}: "${p.template}" — ${p.explanation}`)
    .join('\n');
  const topTopics = (insights.topicsRanking || [])
    .slice(0, 5)
    .map((t, i) => `  ${i + 1}. ${t.topic}: ${t.reason}`)
    .join('\n');
  const titleInsights = titleAnalysis
    ? `\nESTRUCTURA DE TÍTULOS VIRALES (datos reales):
  • Preguntas vs afirmaciones: ${titleAnalysis.questionVsStatement?.bestPerforming} rinden más
  • Elementos obligatorios: ${(titleAnalysis.mustHaveElements || []).join(', ')}
  • Longitud óptima: ~${titleAnalysis.avgTitleLength?.words} palabras`
    : '';

  const insightsBlock = `
════════════════════════════════════════
INSIGHTS DE INVESTIGACIÓN VIRAL (datos reales de YouTube)
Actualizado: ${new Date().toISOString().slice(0, 10)}
════════════════════════════════════════
PATRONES DE HOOK MÁS EFECTIVOS (por engagement real):
${topPatterns}

TOPICS CON MAYOR RENDIMIENTO:
${topTopics}

PALABRAS DE ALTO IMPACTO COMPROBADAS:
${powerWords}

PALABRAS A EVITAR (baja retención):
${avoidWords}

DURACIÓN ÓPTIMA: ${insights.optimalDuration?.seconds}s — ${insights.optimalDuration?.reasoning}
${titleInsights}

MEJORAS BASADAS EN DATOS:
${insights.promptImprovements}`;

  // Reemplaza el bloque existente o añade uno nuevo antes del formato de respuesta
  const marker = '════════════════════════════════════════\nINSIGHTS DE INVESTIGACIÓN VIRAL';
  const endMarker = '════════════════════════════════════════\nFORMATO DE RESPUESTA';

  let updated;
  if (content.includes(marker)) {
    // Ya existe un bloque previo — reemplázalo
    const start = content.indexOf(marker) - 1; // incluye el \n previo
    const end = content.indexOf(endMarker);
    updated = content.slice(0, start) + insightsBlock + '\n\n' + content.slice(end);
  } else {
    // Primera vez — inserta antes del bloque FORMATO DE RESPUESTA
    updated = content.replace(
      '════════════════════════════════════════\nFORMATO DE RESPUESTA',
      insightsBlock + '\n\n════════════════════════════════════════\nFORMATO DE RESPUESTA'
    );
  }

  fs.writeFileSync(GENERATOR_PATH, updated);
  console.log('✅  content-generator.js actualizado con insights reales');
}

// ─────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(RESEARCH_PATH)) {
    console.error('❌  No existe viral-research.json. Ejecuta primero: node scripts/viral-research.js');
    process.exit(1);
  }

  const research = JSON.parse(fs.readFileSync(RESEARCH_PATH, 'utf8'));
  console.log(`📂  Datos cargados: ${research.summary.totalVideosAnalyzed} vídeos | generados el ${research.generatedAt.slice(0, 10)}\n`);

  // Análisis paralelo
  const [insights, titleAnalysis] = await Promise.all([
    analyzePatterns(research),
    analyzeTitleStructure(research.top20Videos),
  ]);

  // Guarda el reporte completo
  const fullReport = {
    generatedAt: new Date().toISOString(),
    basedOnResearch: research.generatedAt,
    insights,
    titleAnalysis,
  };
  fs.writeFileSync(INSIGHTS_PATH, JSON.stringify(fullReport, null, 2));
  console.log(`\n💾  Insights guardados en: ${INSIGHTS_PATH}`);

  // Actualiza los archivos del sistema
  console.log('\n🔧  Aplicando mejoras al sistema...');
  const newHooksCount = updateHooksFile(insights);
  updateContentGenerator(insights, titleAnalysis);

  // Resumen final
  console.log('\n' + '═'.repeat(60));
  console.log('📊  RESUMEN DE HALLAZGOS');
  console.log('═'.repeat(60));
  console.log('\n🎯  Hallazgos clave:');
  (insights.keyFindings || []).forEach((f) => console.log(`   • ${f}`));
  console.log('\n🏆  Patrones de hook más efectivos:');
  (insights.bestHookPatterns || []).slice(0, 3).forEach((p) =>
    console.log(`   • ${p.pattern}: "${p.template}"`)
  );
  console.log('\n⚡  Palabras de alto impacto:', (insights.powerWords || []).join(', '));
  console.log(`\n✅  ${newHooksCount} nuevos hooks añadidos al sistema`);
  console.log('\n🚀  Sistema actualizado. Genera un nuevo vídeo para probar los cambios:');
  console.log('   POST http://localhost:3001/api/videos/generate');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  if (err.message.includes('JSON')) {
    console.error('Error parseando respuesta de Claude. Respuesta raw:', err.stack);
  }
  process.exit(1);
});
