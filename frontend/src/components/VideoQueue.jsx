import { useEffect, useState } from 'react';
import { Play, Plus, RefreshCw, CheckCircle, XCircle, Loader, Layers, ChevronDown } from 'lucide-react';
import axios from 'axios';

const TOPICS = [
  { value: '',                label: '🎲 Auto-selección (recomendado)' },
  { value: 'dark_psychology', label: '🌑 Psicología oscura' },
  { value: 'relationships',   label: '💔 Relaciones tóxicas' },
  { value: 'emotions',        label: '🧠 Emociones' },
  { value: 'cognitive_biases',label: '🔀 Sesgos cognitivos' },
  { value: 'body_language',   label: '👁 Lenguaje corporal' },
  { value: 'self_esteem',     label: '💪 Autoestima' },
  { value: 'motivation',      label: '⚡ Motivación' },
  { value: 'memory',          label: '💾 Memoria' },
  { value: 'social_skills',   label: '🤝 Habilidades sociales' },
  { value: 'workplace',       label: '💼 Trabajo' },
  { value: 'first_impressions',label: '👋 Primera impresión' },
  { value: 'habits',          label: '📅 Hábitos' },
  { value: 'communication',   label: '💬 Comunicación' },
];

const SCORE_COLOR = (s) =>
  s >= 80 ? 'text-emerald-400 bg-emerald-900/40 border-emerald-700/40' :
  s >= 65 ? 'text-yellow-400 bg-yellow-900/40 border-yellow-700/40' :
            'text-red-400 bg-red-900/40 border-red-700/40';

export default function VideoQueue() {
  const [queue,      setQueue]      = useState({ waiting: 0, active: 0, completed: 0, failed: 0 });
  const [topic,      setTopic]      = useState('');
  const [busy,       setBusy]       = useState(false);
  const [message,    setMessage]    = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fetchQueue = () =>
    axios.get('/api/queue').then((r) => setQueue(r.data.data)).catch(() => {});

  useEffect(() => {
    fetchQueue();
    const t = setInterval(fetchQueue, 6000);
    return () => clearInterval(t);
  }, []);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  async function generate() {
    setBusy(true);
    try {
      await axios.post('/api/videos/generate', { topic: topic || null });
      flash('success', '¡Vídeo añadido a la cola!');
      fetchQueue();
    } catch (err) {
      flash('error', err.response?.data?.error || err.message);
    } finally { setBusy(false); }
  }

  async function batch() {
    setBusy(true);
    try {
      const r = await axios.post('/api/videos/batch', { count: 3 });
      flash('success', `${r.data.data.jobIds.length} vídeos añadidos a la cola`);
      fetchQueue();
    } catch (err) {
      flash('error', err.response?.data?.error || err.message);
    } finally { setBusy(false); }
  }

  async function getPreview() {
    setPreviewing(true);
    setPreview(null);
    setShowPreview(true);
    try {
      const r = await axios.post('/api/scripts/preview', { topic: topic || null });
      setPreview(r.data.data);
    } catch (err) {
      flash('error', err.message);
      setShowPreview(false);
    } finally { setPreviewing(false); }
  }

  const topicLabel = TOPICS.find((t) => t.value === topic)?.label || 'Auto-selección';

  return (
    <div className="space-y-5">

      {/* ── Estado ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Estado de la cola</p>
          <button onClick={fetchQueue} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 active:scale-90 transition-all">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Esperando', val: queue.waiting,   col: 'text-slate-200'   },
            { label: 'En curso',  val: queue.active,    col: 'text-blue-400'    },
            { label: 'Listos',    val: queue.completed, col: 'text-emerald-400' },
            { label: 'Fallidos',  val: queue.failed,    col: 'text-red-400'     },
          ].map(({ label, val, col }) => (
            <div key={label}>
              <p className={`text-2xl font-black ${col}`}>{val}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        {queue.active > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-300 bg-blue-500/10 rounded-xl px-3 py-2.5">
            <Loader size={12} className="animate-spin shrink-0" />
            Generando vídeo ahora mismo — puede tardar 2-3 min
          </div>
        )}
      </div>

      {/* ── Generar ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
        <p className="text-sm font-semibold">Generar vídeo</p>

        {/* Selector de tema */}
        <div className="relative">
          <label className="text-[11px] text-slate-400 font-medium mb-1.5 block">Tema del vídeo</label>
          <div className="relative">
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full appearance-none bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-sm pr-10 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={getPreview}
            disabled={previewing || busy}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-sm font-semibold disabled:opacity-50 transition-all"
          >
            {previewing ? <Loader size={15} className="animate-spin" /> : <Play size={15} />}
            Ver guión
          </button>
          <button
            onClick={generate}
            disabled={busy}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-sm font-semibold disabled:opacity-50 transition-all"
          >
            {busy ? <Loader size={15} className="animate-spin" /> : <Plus size={15} />}
            Generar
          </button>
        </div>

        <button
          onClick={batch}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-700/60 hover:bg-purple-600/80 active:scale-95 border border-purple-600/40 text-sm font-semibold disabled:opacity-50 transition-all"
        >
          <Layers size={15} />
          Generar lote de 3 vídeos
        </button>

        {/* Feedback */}
        {message && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl ${
            message.type === 'success'
              ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
              : 'bg-red-900/40 text-red-300 border border-red-700/40'
          }`}>
            {message.type === 'success'
              ? <CheckCircle size={15} className="shrink-0" />
              : <XCircle size={15} className="shrink-0" />}
            {message.text}
          </div>
        )}
      </div>

      {/* ── Preview del guión ──────────────────────────────── */}
      {showPreview && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Preview de guión</p>
            {preview && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${SCORE_COLOR(preview.viralityScore)}`}>
                {preview.viralityScore}/100
              </span>
            )}
          </div>

          {previewing && (
            <div className="flex items-center gap-3 py-6 justify-center text-slate-400">
              <Loader size={18} className="animate-spin" />
              <span className="text-sm">Claude está generando...</span>
            </div>
          )}

          {preview && !previewing && (
            <>
              {/* Métricas */}
              <div className="flex gap-3 flex-wrap">
                <span className="text-[11px] bg-slate-700 px-2.5 py-1 rounded-full text-slate-300">
                  📝 {preview.estimatedWords} palabras
                </span>
                <span className="text-[11px] bg-slate-700 px-2.5 py-1 rounded-full text-slate-300">
                  ⏱ ~{preview.durationSeconds}s
                </span>
                <span className="text-[11px] bg-slate-700 px-2.5 py-1 rounded-full text-slate-300">
                  ⚡ {preview.viralTrigger}
                </span>
                <span className="text-[11px] bg-slate-700 px-2.5 py-1 rounded-full text-slate-300">
                  🏷 {preview.topic}
                </span>
              </div>

              {/* Secciones */}
              {[
                { label: 'HOOK',         text: preview.hook,        color: 'text-yellow-300',  bg: 'bg-yellow-900/20 border-yellow-700/30',  time: '0–3s'    },
                { label: 'CLAIM',        text: preview.claim,       color: 'text-blue-300',    bg: 'bg-blue-900/20 border-blue-700/30',       time: '3–15s'   },
                { label: 'EXPLICACIÓN',  text: preview.explanation, color: 'text-slate-200',   bg: 'bg-slate-700/30 border-slate-600/30',     time: '15–45s'  },
                { label: 'CTA',          text: preview.cta,         color: 'text-emerald-300', bg: 'bg-emerald-900/20 border-emerald-700/30', time: '45–58s'  },
              ].map(({ label, text, color, bg, time }) => (
                <div key={label} className={`rounded-xl border p-3 ${bg}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold font-mono ${color}`}>{label}</span>
                    <span className="text-[10px] text-slate-500">{time}</span>
                  </div>
                  <p className={`text-sm leading-relaxed ${color}`}>{text}</p>
                </div>
              ))}

              {preview.psychologicalFact && (
                <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-xl px-3 py-2.5">
                  <p className="text-[11px] text-indigo-300 font-medium mb-0.5">Dato psicológico central</p>
                  <p className="text-xs text-slate-300 italic">"{preview.psychologicalFact}"</p>
                </div>
              )}

              <button
                onClick={generate}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-sm font-semibold disabled:opacity-50 transition-all"
              >
                {busy ? <Loader size={15} className="animate-spin" /> : <Plus size={15} />}
                Generar este vídeo
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
