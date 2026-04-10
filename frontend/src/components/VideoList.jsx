import { useEffect, useState } from 'react';
import { Film, RefreshCw, Youtube, ExternalLink, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

const TOPIC_LABELS = {
  body_language:    'Lenguaje corporal',
  cognitive_biases: 'Sesgos cognitivos',
  relationships:    'Relaciones',
  workplace:        'Trabajo',
  first_impressions:'Primera impresión',
  social_skills:    'Habilidades sociales',
  habits:           'Hábitos',
  communication:    'Comunicación',
  emotions:         'Emociones',
  memory:           'Memoria',
  motivation:       'Motivación',
  dark_psychology:  'Psicología oscura',
  self_esteem:      'Autoestima',
};

function ScoreBadge({ score }) {
  if (!score) return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">?</span>;
  const cls =
    score >= 80 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/40' :
    score >= 65 ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/40' :
                  'bg-red-900/50 text-red-400 border border-red-700/40';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cls}`}>
      {score}/100
    </span>
  );
}

function VideoCard({ v, onUpload, uploading }) {
  const [expanded, setExpanded] = useState(false);
  const script = v.script || {};
  const score  = script.viralityScore;
  const topic  = TOPIC_LABELS[script.topic] || script.topic || '—';

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 overflow-hidden">
      {/* Cabecera */}
      <div
        className="p-4 cursor-pointer active:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start gap-3">
          {/* Score circular */}
          <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black border ${
            score >= 80 ? 'bg-emerald-900/40 border-emerald-700/40 text-emerald-400' :
            score >= 65 ? 'bg-yellow-900/40 border-yellow-700/40 text-yellow-400' :
                          'bg-slate-700/60 border-slate-600 text-slate-400'
          }`}>
            {score || '?'}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug line-clamp-2">
              {script.hook || 'Sin hook'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[11px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {topic}
              </span>
              {script.durationSeconds && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock size={10} />
                  {script.durationSeconds}s
                </span>
              )}
              {script.viralTrigger && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Zap size={10} />
                  {script.viralTrigger}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-slate-500">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Expandido */}
      {expanded && (
        <div className="border-t border-slate-700/60 px-4 pb-4 pt-3 space-y-3">
          {/* Guión */}
          {[
            { label: 'Hook',        text: script.hook,        color: 'text-yellow-300' },
            { label: 'Claim',       text: script.claim,       color: 'text-blue-300'   },
            { label: 'Explicación', text: script.explanation, color: 'text-slate-300'  },
            { label: 'CTA',         text: script.cta,         color: 'text-emerald-300'},
          ].filter((s) => s.text).map(({ label, text, color }) => (
            <div key={label}>
              <p className="text-[10px] text-slate-500 font-mono mb-0.5">{label.toUpperCase()}</p>
              <p className={`text-sm leading-relaxed ${color}`}>{text}</p>
            </div>
          ))}

          {script.psychologicalFact && (
            <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-xl px-3 py-2">
              <p className="text-[10px] text-indigo-300 font-medium mb-0.5">Dato psicológico</p>
              <p className="text-xs text-slate-300 italic">"{script.psychologicalFact}"</p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onUpload(v.id)}
              disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-900/40 hover:bg-red-800/60 active:scale-95 border border-red-700/40 text-red-300 text-xs font-semibold disabled:opacity-50 transition-all"
            >
              {uploading
                ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                : <Youtube size={13} />}
              {uploading ? 'Subiendo...' : 'Subir a YouTube'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VideoList() {
  const [videos,   setVideos]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [uploading, setUploading] = useState({});
  const [uploadMsg, setUploadMsg] = useState({});

  const load = () => {
    setLoading(true);
    axios.get('/api/videos/local')
      .then((r) => setVideos(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleUpload(videoId) {
    setUploading((u) => ({ ...u, [videoId]: true }));
    setUploadMsg((m) => ({ ...m, [videoId]: null }));
    try {
      const r = await axios.post('/api/videos/upload-youtube', { videoId });
      setUploadMsg((m) => ({ ...m, [videoId]: { ok: true, text: '¡Subido! ' + (r.data.data?.url || '') } }));
    } catch (err) {
      setUploadMsg((m) => ({ ...m, [videoId]: { ok: false, text: err.response?.data?.error || err.message } }));
    } finally {
      setUploading((u) => ({ ...u, [videoId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Cargando vídeos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-bold">Vídeos generados</p>
          <p className="text-xs text-slate-400 mt-0.5">{videos.length} vídeo{videos.length !== 1 ? 's' : ''} en local</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-xl hover:bg-slate-700 active:scale-90 text-slate-400 transition-all"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
          <Film size={40} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-300 font-semibold">Sin vídeos todavía</p>
          <p className="text-slate-500 text-sm mt-1">Ve a "Generar" para crear el primero</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <div key={v.id}>
              <VideoCard
                v={v}
                onUpload={handleUpload}
                uploading={uploading[v.id]}
              />
              {uploadMsg[v.id] && (
                <div className={`mt-1.5 text-xs px-3 py-2 rounded-xl ${
                  uploadMsg[v.id].ok
                    ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                    : 'bg-red-900/40 text-red-300 border border-red-700/40'
                }`}>
                  {uploadMsg[v.id].ok && <ExternalLink size={11} className="inline mr-1" />}
                  {uploadMsg[v.id].text}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
