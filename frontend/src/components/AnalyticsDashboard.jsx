import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import axios from 'axios';

function StatCard({ icon: Icon, label, value, delta, color }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-sm font-medium">{label}</span>
        <Icon size={18} className={color} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {delta !== undefined && (
        <p className={`text-xs mt-1 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {delta >= 0 ? '+' : ''}{delta}% vs semana anterior
        </p>
      )}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/stats')
      .then((r) => setStats(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totals = stats?.totals || {};
  const topVideos = stats?.topVideos || [];
  const recentMetrics = stats?.recentMetrics || [];

  // Agrupa métricas por fecha para el gráfico
  const chartData = recentMetrics.reduce((acc, m) => {
    const existing = acc.find((d) => d.date === m.date);
    if (existing) {
      existing[m.platform] = parseInt(m.views || 0);
    } else {
      acc.push({ date: m.date, [m.platform]: parseInt(m.views || 0) });
    }
    return acc;
  }, []).reverse();

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Eye}
          label="Views totales (30d)"
          value={parseInt(totals.total_views || 0).toLocaleString()}
          color="text-blue-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Engagement promedio"
          value={`${parseFloat(totals.avg_engagement || 0).toFixed(2)}%`}
          color="text-emerald-400"
        />
        <StatCard
          icon={Heart}
          label="Videos publicados"
          value={parseInt(totals.total_videos || 0)}
          color="text-pink-400"
        />
        <StatCard
          icon={MessageCircle}
          label="Top video (views)"
          value={topVideos[0] ? parseInt(topVideos[0].max_views).toLocaleString() : '—'}
          color="text-yellow-400"
        />
      </div>

      {/* Gráfico de Views por plataforma */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
        <h3 className="text-base font-semibold mb-4">Views por plataforma (últimos 7 días)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            />
            <Legend />
            <Line type="monotone" dataKey="tiktok" stroke="#ff2d55" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="instagram" stroke="#c77dff" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="youtube" stroke="#ff6b35" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Videos */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
        <h3 className="text-base font-semibold mb-4">Top 5 Videos</h3>
        <div className="space-y-3">
          {topVideos.length === 0 && (
            <p className="text-slate-500 text-sm">No hay datos todavía. Publica tu primer video.</p>
          )}
          {topVideos.map((v, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-xl">
              <span className="text-2xl font-black text-slate-600 w-8">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{v.hook}</p>
                <p className="text-xs text-slate-400">{v.topic}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{parseInt(v.max_views || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-400">views</p>
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${parseFloat(v.max_engagement) > 5 ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {parseFloat(v.max_engagement || 0).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400">eng.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
