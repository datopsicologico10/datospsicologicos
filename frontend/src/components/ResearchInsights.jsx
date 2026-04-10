import { useEffect, useState } from 'react';
import { TrendingUp, Zap, AlertTriangle, Clock, Target, BookOpen, RefreshCw } from 'lucide-react';

export default function ResearchInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState(null);

  const loadInsights = () => {
    setLoading(true);
    fetch('/api/research/insights')
      .then((r) => r.json())
      .then((json) => { setData(json.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadInsights(); }, []);

  const triggerResearch = () => {
    setRunning(true);
    setRunMsg(null);
    fetch('/api/research/run', { method: 'POST' })
      .then((r) => r.json())
      .then((json) => {
        setRunMsg(json.message);
        setRunning(false);
        // Recarga los insights después de 2 minutos
        setTimeout(loadInsights, 120000);
      })
      .catch(() => setRunning(false));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <span className="animate-pulse">Cargando insights...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-8 text-center">
        <BookOpen size={36} className="mx-auto mb-3 text-slate-500" />
        <p className="text-slate-300 font-medium mb-1">Sin datos de investigación todavía</p>
        <p className="text-slate-500 text-sm mb-4">Ejecuta los scripts para analizar los vídeos más virales de tu nicho</p>
        <div className="bg-slate-900 rounded-lg p-4 text-left text-xs font-mono text-emerald-400 space-y-1">
          <p># 1. Añade YOUTUBE_API_KEY en backend/.env</p>
          <p>node scripts/viral-research.js</p>
          <p>node scripts/analyze-patterns.js</p>
        </div>
      </div>
    );
  }

  const { insights, titleAnalysis, generatedAt } = data;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Investigación viral</h2>
          <p className="text-xs text-slate-400">
            Basado en datos reales de YouTube · Actualizado {new Date(generatedAt).toLocaleDateString('es-ES')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
            Datos reales
          </span>
          <button
            onClick={triggerResearch}
            disabled={running}
            className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 px-3 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
            {running ? 'Analizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Mensaje de investigación en curso */}
      {runMsg && (
        <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 px-4 py-2 text-sm text-indigo-300">
          ⏳ {runMsg} — el dashboard se actualizará automáticamente.
        </div>
      )}

      {/* Hallazgos clave */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-300">Hallazgos clave</span>
        </div>
        <ul className="space-y-1.5">
          {(insights.keyFindings || []).map((f, i) => (
            <li key={i} className="text-sm text-slate-300 flex gap-2">
              <span className="text-indigo-400 shrink-0">•</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Patrones de hook */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-yellow-400" />
          <span className="text-sm font-semibold text-slate-200">Patrones de hook más efectivos</span>
        </div>
        <div className="space-y-3">
          {(insights.bestHookPatterns || []).map((p, i) => (
            <div key={i} className="bg-slate-900/60 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-mono">
                  {p.pattern}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-1">{p.explanation}</p>
              <p className="text-sm text-white font-mono bg-slate-800 rounded px-2 py-1">
                "{p.template}"
              </p>
              {p.example && (
                <p className="text-xs text-slate-500 mt-1">Ej: "{p.example}"</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Duración óptima + Topics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">Duración óptima</span>
          </div>
          <p className="text-3xl font-bold text-cyan-400">{insights.optimalDuration?.seconds}s</p>
          <p className="text-xs text-slate-400 mt-1">{insights.optimalDuration?.reasoning}</p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-purple-400" />
            <span className="text-sm font-semibold text-slate-200">Topics por ranking</span>
          </div>
          <ol className="space-y-0.5">
            {(insights.topicsRanking || []).slice(0, 5).map((t, i) => (
              <li key={i} className="text-xs flex gap-1.5 text-slate-300">
                <span className="text-purple-400 shrink-0">{i + 1}.</span>
                <span className="font-mono">{t.topic}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Palabras */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/10 p-4">
          <p className="text-xs font-semibold text-emerald-400 mb-2">Palabras de alto impacto</p>
          <div className="flex flex-wrap gap-1.5">
            {(insights.powerWords || []).map((w) => (
              <span key={w} className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                {w}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-red-700/40 bg-red-900/10 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-red-400" />
            <p className="text-xs font-semibold text-red-400">Palabras a evitar</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(insights.wordsToAvoid || []).map((w) => (
              <span key={w} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded line-through">
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Análisis de títulos */}
      {titleAnalysis && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
          <p className="text-sm font-semibold text-slate-200 mb-3">Estructura de títulos virales</p>
          <div className="grid grid-cols-3 gap-3 mb-3 text-center">
            <div className="bg-slate-900/60 rounded-lg p-2">
              <p className="text-lg font-bold text-white">{titleAnalysis.avgTitleLength?.words}</p>
              <p className="text-xs text-slate-400">palabras óptimas</p>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2">
              <p className="text-lg font-bold text-white">{titleAnalysis.numberUsage?.percentage}%</p>
              <p className="text-xs text-slate-400">usan número</p>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2">
              <p className="text-lg font-bold text-white capitalize">
                {titleAnalysis.questionVsStatement?.bestPerforming === 'questions' ? 'Preguntas' : 'Afirm.'}
              </p>
              <p className="text-xs text-slate-400">rinden más</p>
            </div>
          </div>
          {(titleAnalysis.mustHaveElements || []).length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Elementos obligatorios en títulos virales:</p>
              <div className="flex flex-wrap gap-1.5">
                {(titleAnalysis.mustHaveElements || []).map((e) => (
                  <span key={e} className="text-xs bg-slate-700 text-slate-200 px-2 py-0.5 rounded">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mejoras al prompt */}
      {insights.promptImprovements && (
        <div className="rounded-xl border border-slate-600 bg-slate-800/20 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Mejoras aplicadas al generador</p>
          <p className="text-sm text-slate-300 leading-relaxed">{insights.promptImprovements}</p>
        </div>
      )}
    </div>
  );
}
