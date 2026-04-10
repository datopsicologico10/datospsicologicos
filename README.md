# Psychology Shorts Automation 🧠

Sistema automatizado para generar y publicar **Psychology Facts Shorts/Reels virales** en TikTok, Instagram y YouTube.

## Pipeline completo

```
Claude API → ElevenLabs TTS → FFmpeg render → TikTok/IG/YouTube
     ↑_______________ Analytics feedback loop _______________↑
```

## Stack gratuito — Solo pagas Claude

| Componente | Antes | Ahora | Coste |
|------------|-------|-------|-------|
| TTS (voz) | ElevenLabs $22/mes | **Microsoft Edge TTS** | **GRATIS** |
| Base de datos | PostgreSQL (servidor) | **SQLite** (archivo local) | **GRATIS** |
| Cola de trabajos | Redis + BullMQ | **Cola de archivos JSON** | **GRATIS** |
| Fondos de video | Pexels API | **Canvas gradientes** | **GRATIS** |
| Claude API | Claude API | Claude API | ~$2-5/mes |
| **Total** | ~$55/mes | **~$2-5/mes** | **↓ 95%** |

## Setup rápido

### 1. Requisitos previos

```bash
# Node.js 18+
node --version   # >= 18

# FFmpeg (único binario externo necesario)
ffmpeg -version  # instalar desde ffmpeg.org o: winget install ffmpeg
```

### 2. Clonar e instalar

```bash
# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install
```

### 3. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
# Solo necesitas rellenar ANTHROPIC_API_KEY
```

Variable **obligatoria** (única de pago):
| Variable | Descripción | Dónde obtenerla |
|----------|-------------|-----------------|
| `ANTHROPIC_API_KEY` | Claude API | console.anthropic.com |

Variables **opcionales** (para publicación automática):
| Variable | Descripción |
|----------|-------------|
| `TIKTOK_ACCESS_TOKEN` | TikTok Creator API (gratis con cuenta developer) |
| `INSTAGRAM_ACCESS_TOKEN` | Meta Graph API (gratis con cuenta business) |
| `YOUTUBE_REFRESH_TOKEN` | YouTube Data API v3 (gratis con cuenta Google) |

**Sin las APIs de publicación**, el sistema genera los videos localmente en `./output/` y puedes subirlos manualmente.

### 4. Inicializar base de datos SQLite (automático)

La base de datos se crea automáticamente en `backend/data/psychology_shorts.db` al arrancar el servidor. No necesitas instalar nada.

### 5. Test end-to-end (genera 1 video sin publicar)

```bash
node scripts/test-generate.js
```

Esto genera un video completo en `./output/test_<id>/output.mp4` sin publicarlo.

### 6. Arrancar el sistema completo

Terminal 1 — API Server:
```bash
cd backend && npm start
```

Terminal 2 — Worker de procesamiento:
```bash
cd backend && npm run worker
```

Terminal 3 — Dashboard React:
```bash
cd frontend && npm run dev
# Abre: http://localhost:5173
```

### 7. Generar un lote manual

```bash
# Genera 3 videos (auto-topic)
node scripts/generate-batch.js 3

# Genera 1 video de un tema específico
node scripts/generate-batch.js 1 body_language
```

---

## Arquitectura

```
backend/
├── src/
│   ├── services/
│   │   ├── content-generator.js   # Claude API → guión JSON
│   │   ├── voice-synthesizer.js   # ElevenLabs → audio MP3
│   │   ├── video-renderer.js      # FFmpeg → video MP4 1080x1920
│   │   ├── publisher.js           # TikTok + Instagram + YouTube
│   │   └── analytics-tracker.js  # Polling métricas → PostgreSQL
│   ├── queue/
│   │   └── video-processor.js     # BullMQ worker + cron jobs
│   ├── utils/
│   │   ├── virality-scorer.js     # Scoring 0-100
│   │   └── subtitle-generator.js  # Word-by-word subtítulos
│   └── server.js                  # Express API
└── templates/
    ├── psychology-hooks.json      # 20 hooks probados
    ├── visual-themes.json         # 5 temas visuales
    └── video-structure.json       # Timings y spec técnico
```

## Flujo de publicación

| Plataforma | Horario | Delay |
|------------|---------|-------|
| TikTok | 15:00 / 18:00 / 21:00 CET | inmediato |
| Instagram | 15:30 / 18:30 / 21:30 CET | +30 min |
| YouTube | 16:00 / 19:00 / 22:00 CET | +60 min |

**Días prioritarios**: miércoles, jueves, viernes (mayor engagement histórico)

## Scoring de viralidad

| Componente | Máximo | Descripción |
|------------|--------|-------------|
| Hook strength | 30 pts | Pregunta, stat, controversia |
| Emotional trigger | 25 pts | Fear, curiosity, awe, validation |
| Relatability | 20 pts | Segunda persona, "todos", "tú" |
| Loop potential | 15 pts | CTA con pregunta, cliffhanger |
| Duration bonus | 10 pts | 55-62 segundos = óptimo |
| **Total** | **100 pts** | Mínimo 70 para auto-publicar |

## Estimación de costos mensuales

Basado en 90 videos/mes (3 diarios):

| Servicio | Solución | Coste |
|----------|----------|-------|
| Claude API (Sonnet) | 90 guiones × ~1K tokens | ~$2-5/mes |
| TTS (voz) | Microsoft Edge TTS | **$0** |
| Base de datos | SQLite local | **$0** |
| Cola de trabajos | Archivos JSON | **$0** |
| Fondos de video | Canvas generativo | **$0** |
| FFmpeg (render) | Open source local | **$0** |
| Frontend | Vercel hobby | **$0** |
| **TOTAL** | | **~$2-5/mes** |

## Deployment

```bash
bash scripts/deploy.sh
```

O manualmente:
- **Backend**: Railway → conecta repo → `npm start`
- **Worker**: Railway → segundo servicio → `npm run worker`
- **Frontend**: Vercel → conecta repo → auto-deploy

---

## Personalización

### Cambiar el tema visual
Edita `backend/src/templates/visual-themes.json` y modifica `rotation`.

### Añadir nuevos hooks
Añade entradas a `backend/src/templates/psychology-hooks.json`.

### Cambiar horarios de publicación
Edita `PUBLISH_TIMES_CET` en el `.env`.

### Ajustar umbral de viralidad
Edita `MIN_VIRALITY_SCORE` en el `.env` (default: 70).

---

*Generado con Claude — sistema listo para producción*
