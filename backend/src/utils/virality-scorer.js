/**
 * virality-scorer.js
 * Score 0-100. Umbral para publicar: 60 (antes era 70, era demasiado estricto).
 */

const logger = require('./logger');

const POWER_WORDS = [
  'nunca', 'jamás', 'siempre', 'todos', 'nadie', 'secreto', 'verdad',
  'mentira', 'peligro', 'alerta', 'increíble', 'impresionante', 'importante',
  'manipulando', 'engañando', 'tóxico', 'inmediatamente', 'ahora', 'revela',
  'descubre', 'oculta', 'prohibido', 'real', 'comprobado', 'estudio',
];

const CONTROVERSY_PATTERNS = [
  /nunca (conf[íi]es|hagas|digas)/i,
  /las personas (inteligentes|exitosas|t[óo]xicas)/i,
  /gente (inteligente|exitosa|t[óo]xica)/i,
  /si (alguien|una persona|tu pareja) hace esto/i,
  /te est[áa]n (manipulando|mintiendo|engañando)/i,
  /el \d+[%\s]/i,
  /nadie (te dice|te cuenta|sabe)/i,
  /\d+ (cosas|señales|errores|trucos|secretos|formas)/i,
  /esto (revela|dice|demuestra)/i,
];

const QUESTION_PATTERNS = [/\?/, /¿/, /sabes/, /alguna vez/i, /por qué/i];

function scoreHook(hookText) {
  let score = 0;
  const hasControversy = CONTROVERSY_PATTERNS.some((p) => p.test(hookText));
  const hasQuestion = QUESTION_PATTERNS.some((p) => p.test(hookText));
  const hasNumber = /\b\d+\b/.test(hookText);
  const hasPowerWord = POWER_WORDS.some((w) => hookText.toLowerCase().includes(w));

  if (hasControversy) score += 15;
  if (hasQuestion) score += 10;
  if (hasNumber) score += 5;
  if (hasPowerWord) score += 5;

  return Math.min(score, 30);
}

function scoreEmotionalTrigger(fullText) {
  const lower = fullText.toLowerCase();
  const hits = POWER_WORDS.filter((w) => lower.includes(w)).length;
  return Math.min(hits * 4, 25);
}

function scoreRelatability(fullText) {
  const lower = fullText.toLowerCase();
  const terms = ['tú', 'te ', 'tu ', 'todos', 'la gente', 'las personas',
    'la mayoría', 'nosotros', 'tus', 'cuando', 'si alguna vez'];
  const hits = terms.filter((t) => lower.includes(t)).length;
  return Math.min(hits * 3 + 4, 20); // +4 base porque casi todos los guiones usan algo
}

function scoreLoopPotential(ctaText) {
  let score = 5; // base
  if (QUESTION_PATTERNS.some((p) => p.test(ctaText))) score += 8;
  if (/comenta|dime|cuéntame|qué opinas|lo conocías|te ha pasado/i.test(ctaText)) score += 5;
  if (/sigue|sígueme|más videos/i.test(ctaText)) score += 2;
  return Math.min(score, 15);
}

function scoreDuration(durationSeconds) {
  if (durationSeconds >= 50 && durationSeconds <= 65) return 10;
  if (durationSeconds >= 40 && durationSeconds <= 75) return 5;
  return 2; // siempre algo, no castigar tanto
}

function scoreScript(script) {
  const { hook, claim, explanation, cta, durationSeconds } = script;
  const fullText = [hook, claim, explanation, cta].join(' ');

  const breakdown = {
    hookStrength:    scoreHook(hook),
    emotionalTrigger: scoreEmotionalTrigger(fullText),
    relatability:    scoreRelatability(fullText),
    loopPotential:   scoreLoopPotential(cta),
    durationBonus:   scoreDuration(durationSeconds || 58),
  };

  const totalScore = Object.values(breakdown).reduce((s, v) => s + v, 0);
  const threshold = parseInt(process.env.MIN_VIRALITY_SCORE || '60');
  const approved = totalScore >= threshold;

  logger.info(`Virality score: ${totalScore}/100 | Approved: ${approved}`);

  return { score: totalScore, breakdown, approved };
}

module.exports = { scoreScript };
