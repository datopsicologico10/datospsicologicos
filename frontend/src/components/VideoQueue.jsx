import { useEffect, useState } from 'react';
import { Play, Plus, RefreshCw, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import axios from 'axios';

const TOPICS = [
  { value: '', label: 'Auto-selección' },
  { value: 'body_language', label: 'Lenguaje corporal' },
  { value: 'cognitive_biases', label: 'Sesgos cognitivos' },
  { value: 'relationships', label: 'Relaciones' },
  { value: 'workplace', label: 'Trabajo' },
  { value: 'first_impressions', label: 'Primera impresión' },
  { value: 'social_skills', label: 'Habilidades sociales' },
];

function QueueBadge({ count, label, color }) {
  return (
    <div className={`rounded-xl px-4 py-3 bg-slate-800/60 border ${color}`}>
      <p className="text-2xl font-black">{count}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function VideoQueue() {
  const [queue, setQueue] = useState({ waiting: 0, active: 0, completed: 0, failed: 0 });
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  const fetchQueue = () => {
    axios.get('/api/queue')
      .then((r) => setQueue(r.data.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 8000);
    return () => clearInterval(interval);
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await axios.post('/api/videos/generate', { topic: topic || null });
      setMessage({ type: 'success', text: `Video en cola (Job: ${res.data.data.jobId})` });
      fetchQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setGenerating(false);
    }
  }

  async function handleBatch() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await axios.post('/api/videos/batch', { count: 3 });
      setMessage({ type: 'success', text: `${res.data.data.jobIds.length} videos en cola` });
      fetchQueue();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setGenerating(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreview(null);
    try {
      const res = await axios.post('/api/scripts/preview', { topic: topic || null });
      setPreview(res.data.data);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Estado de la cola */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Estado de la cola</h3>
          <button onClick={fetchQueue} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <QueueBadge count={queue.waiting} label="Esperando" color="border-slate-700" />
          <QueueBadge count={queue.active} label="Procesando" color="border-blue-500/40" />
          <QueueBadge count={queue.completed} label="Completados" color="border-emerald-500/40" />
          <QueueBadge count={queue.failed} label="Fallidos" color="border-red-500/40" />
        </div>
      </div>

      {/* Controles de generación */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-4">
        <h3 className="text-base font-semibold">Generar video</h3>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Tema</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium disabled:opacity-50"
          >
            {previewing ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
            Preview guión
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium disabled:opacity-50"
          >
            {generating ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
            Generar video
          </button>
          <button
            onClick={handleBatch}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-sm font-medium disabled:opacity-50"
          >
            <Plus size={14} />
            Lote × 3
          </button>
        </div>

        {message && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
            message.type === 'success'
              ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50'
              : 'bg-red-900/40 text-red-400 border border-red-700/50'
          }`}>
            {message.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {message.text}
          </div>
        )}
      </div>

      {/* Preview del guión */}
      {preview && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Preview: {preview.title}</h3>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              preview.approved ? 'bg-emerald-900/60 text-emerald-400' : 'bg-yellow-900/60 text-yellow-400'
            }`}>
              Score: {preview.viralityScore}/100
            </span>
          </div>

          {[
            { label: 'HOOK (0-3s)', text: preview.hook, color: 'text-yellow-300' },
            { label: 'CLAIM (3-15s)', text: preview.claim, color: 'text-blue-300' },
            { label: 'EXPLICACIÓN (15-45s)', text: preview.explanation, color: 'text-slate-200' },
            { label: 'CTA (45-58s)', text: preview.cta, color: 'text-emerald-300' },
          ].map(({ label, text, color }) => (
            <div key={label}>
              <p className="text-xs text-slate-500 font-mono mb-1">{label}</p>
              <p className={`text-sm leading-relaxed ${color}`}>{text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
