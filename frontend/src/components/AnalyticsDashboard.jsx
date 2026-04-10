import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Eye, TrendingUp, Film, Zap, Clock, ChevronRight, AlertCircle, Play } from 'lucide-react';
import axios from 'axios';

// Próximo vídeo programado hoy
function getNextVideo() {
  const times = ['15:00', '18:00', '21:00'];
  const now = new Date();
  const todayStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const next = times.find((t) => t > todayStr);
  if (!next) return { time: times[0], label: 'Mañana a las' };
  return { time: next, label: 'Hoy a las' };
}

function Countdown() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const times = ['15:00', '18:00', '21:00'];
  const todayStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const next = times.find((t) => t > todayStr);
  const target = new Date(now);
  if (next) {
    const [h, m] = next.split(':');
    target.setHours(parseInt(h), parseInt(m), 0, 0);
  } else {
    target.setDate(target.getDate() + 1);
    const [h, m] = times[0].split(':');
    target.setHours(parseInt(h), parseInt(m), 0, 0);
  }
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  const hh = String(Math.floor(diff / 3600)).padStart(2, '0');
  const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const ss = String(diff % 60).padStart(2, '0');
  return <span className="font-mono tabular-nums">{hh}:{mm}:{ss}</span>;
}

function KpiCard({ icon: Icon, label, value, sub, accent }) {
  const colors = {
    blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: 'text-blue-400'   },
    green:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
    purple: { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  icon: 'text-purple-400'  },
    yellow: { bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20',  icon: 'text-yellow-400'  },
  };
  const c = colors[accent] || colors.blue;
  return (
    <div className={`rounded-2xl border ${c.bg} ${c.border} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <Icon size={16} className={c.icon} />
      </div>
      <p className="text-2xl font-black tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AnalyticsDashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/stats'),
      axios.get('/api/queue'),
    ]).then(([s, q]) => {
      setStats(s.data.data);
      setQueue(q.data.data);
    }).catch(console.error)
      .finally(() => setLoading(false));

    const t = setInterval(() => {
      axios.get('/api/queue').then((r) => setQueue(r.data.data)).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const totals   = stats?.totals   || {};
  const topVideos = stats?.topVideos || [];
  const recentMetrics = stats?.recentMetrics || [];

  // Datos para gráfico de barras: views de los últimos 7 días sumados
  const chartData = (() => {
    const byDate = {};
    recentMetrics.forEach((m) => {
      byDate[m.date] = (byDate[m.date] || 0) + parseInt(m.views || 0);
    });
    return Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, views]) => ({ date: date.slice(5), views }));
  })();

  const totalVideos = parseInt(totals.total_videos || 0);
  const totalViews  = parseInt(totals.total_views  || 0);
  const avgEng      = parseFloat(totals.avg_engagement || 0).toFixed(1);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Próximo vídeo ───────────────────────────────────── */}
      <div className="rounded-2xl bg-indigo-600/10 border border-indigo-500/25 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-300 font-medium mb-1">Próximo vídeo automático</p>
            <p className="text-3xl font-black text-white"><Countdown /></p>
            <p className="text-xs text-slate-400 mt-1">
              {getNextVideo().label} {getNextVideo().time} · 3 vídeos/día
            </p>
          </div>
          <button
            onClick={() => onNavigate('queue')}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
          >
            <Play size={14} fill="currentColor" />
            Generar ya
          </button>
        </div>
      </div>

      {/* ── Estado de la cola ───────────────────────────────── */}
      {queue && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <p className="text-xs text-slate-400 font-medium mb-3">Estado de la cola</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Esperando', val: queue.waiting,   color: 'text-slate-300'  },
              { label: 'En curso',  val: queue.active,    color: 'text-blue-400'   },
              { label: 'Hechos',    val: queue.completed, color: 'text-emerald-400'},
              { label: 'Fallidos',  val: queue.failed,    color: 'text-red-400'    },
            ].map(({ label, val, color }) => (
              <div key={label} className="text-center">
                <p className={`text-xl font-black ${color}`}>{val}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {queue.active > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-300 bg-blue-500/10 rounded-lg px-3 py-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shrink-0" />
              Generando vídeo ahora mismo...
            </div>
          )}
          {queue.failed > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle size={12} className="shrink-0" />
              {queue.failed} vídeo{queue.failed > 1 ? 's' : ''} fallido{queue.failed > 1 ? 's' : ''}. Revisa los logs.
            </div>
          )}
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={Film}      label="Vídeos publicados" value={totalVideos}                     sub="desde el inicio"       accent="purple" />
        <KpiCard icon={Eye}       label="Views totales"     value={totalViews ? totalViews.toLocaleString() : '—'}  sub="todas las plataformas" accent="blue"   />
        <KpiCard icon={TrendingUp} label="Engagement medio" value={`${avgEng}%`}                   sub="likes+comentarios/views" accent="green"  />
        <KpiCard icon={Zap}       label="Mejor vídeo"       value={topVideos[0] ? parseInt(topVideos[0].max_views).toLocaleString() : '—'} sub="views en un vídeo" accent="yellow" />
      </div>

      {/* ── Gráfico de views ────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <p className="text-sm font-semibold mb-4">Views últimos 7 días</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={28}>
              <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }}
                formatter={(v) => [v.toLocaleString(), 'Views']}
              />
              <Bar dataKey="views" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#6366f1' : '#334155'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top vídeos ──────────────────────────────────────── */}
      {topVideos.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <p className="text-sm font-semibold mb-3">Tus mejores vídeos</p>
          <div className="space-y-2">
            {topVideos.slice(0, 5).map((v, i) => {
              const views = parseInt(v.max_views || 0);
              const eng   = parseFloat(v.max_engagement || 0);
              const maxViews = parseInt(topVideos[0].max_views || 1);
              const pct = Math.max(4, Math.round((views / maxViews) * 100));
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-300 truncate flex-1 leading-snug">{v.hook}</p>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold">{views.toLocaleString()}</p>
                      <p className={`text-[10px] ${eng > 5 ? 'text-emerald-400' : 'text-slate-500'}`}>{eng.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Estado si no hay datos ──────────────────────────── */}
      {totalVideos === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
          <Film size={36} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-300 font-semibold mb-1">Sin vídeos todavía</p>
          <p className="text-slate-500 text-sm mb-4">Genera tu primer vídeo para ver las estadísticas</p>
          <button
            onClick={() => onNavigate('queue')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            Generar primer vídeo
          </button>
        </div>
      )}
    </div>
  );
}
