import { useEffect, useState } from 'react';
import { Film, Upload, RefreshCw, Youtube, Music } from 'lucide-react';
import axios from 'axios';

export default function VideoList() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});

  const fetchVideos = () => {
    setLoading(true);
    axios.get('/api/videos/local')
      .then((r) => setVideos(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVideos(); }, []);

  async function handleUploadYouTube(videoId) {
    setUploading((u) => ({ ...u, [videoId]: 'youtube' }));
    try {
      await axios.post('/api/videos/upload-youtube', { videoId });
      alert('¡Subido a YouTube!');
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading((u) => ({ ...u, [videoId]: null }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Vídeos generados ({videos.length})</h3>
        <button onClick={fetchVideos} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
          <RefreshCw size={14} />
        </button>
      </div>

      {videos.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Film size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay vídeos todavía.</p>
          <p className="text-sm mt-1">Ve a "Cola" para generar el primero.</p>
        </div>
      )}

      <div className="space-y-3">
        {videos.map((v) => (
          <div key={v.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    (v.script?.viralityScore || 0) >= 70
                      ? 'bg-emerald-900/60 text-emerald-400'
                      : (v.script?.viralityScore || 0) >= 60
                      ? 'bg-yellow-900/60 text-yellow-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {v.script?.viralityScore || '?'}/100
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{v.id}</span>
                </div>
                <p className="font-medium text-sm leading-snug truncate">
                  {v.script?.hook || 'Sin título'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {v.script?.topic} · {v.script?.estimatedWords || '—'} palabras · {v.script?.durationSeconds || '—'}s
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleUploadYouTube(v.id)}
                  disabled={uploading[v.id] === 'youtube'}
                  title="Subir a YouTube"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-700/40 text-red-400 text-xs font-medium disabled:opacity-50"
                >
                  {uploading[v.id] === 'youtube'
                    ? <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                    : <Youtube size={12} />}
                  YouTube
                </button>
              </div>
            </div>

            {v.script?.psychologicalFact && (
              <p className="text-xs text-slate-500 mt-2 italic border-t border-slate-700/50 pt-2">
                "{v.script.psychologicalFact}"
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
