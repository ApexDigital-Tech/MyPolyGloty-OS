import React, { useMemo } from 'react';
import { type PitchFrame, type MandarinTone } from '../phonetics/PitchTracker';
import { Volume2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';

interface MandarinToneVisualizerProps {
  pitchContour?: PitchFrame[];
  targetTone: number; // 1, 2, 3, 4
  detectedTone?: MandarinTone;
  targetPinyin?: string;
  hanzi?: string;
  onPlayTargetAudio?: () => void;
  onPlayUserAudio?: () => void;
}

const TONE_NAMES: Record<number, { name: string; desc: string; contour: string; points: Array<[number, number]> }> = {
  1: {
    name: '1er Tono (Yīn Píng)',
    desc: 'Alto y plano continuo (5-5). Sin vibrato ni caída.',
    contour: '5-5',
    points: [[0, 5], [25, 5], [50, 5], [75, 5], [100, 5]],
  },
  2: {
    name: '2do Tono (Yáng Píng)',
    desc: 'Ascendente de rango medio a alto (3-5), como una pregunta sorprendida.',
    contour: '3-5',
    points: [[0, 3], [30, 3.2], [60, 4.0], [80, 4.7], [100, 5]],
  },
  3: {
    name: '3er Tono (Shǎng Shēng)',
    desc: 'Descendente-ascendente (2-1-4). Cae al grave y sube al final.',
    contour: '2-1-4',
    points: [[0, 2], [30, 1.2], [50, 1], [75, 2.5], [100, 4]],
  },
  4: {
    name: '4to Tono (Qù Shēng)',
    desc: 'Descendente abrupto (5-1). Caída rápida y enérgica como una orden.',
    contour: '5-1',
    points: [[0, 5], [25, 4.2], [50, 3.0], [75, 1.8], [100, 1]],
  },
};

export const MandarinToneVisualizer: React.FC<MandarinToneVisualizerProps> = ({
  pitchContour = [],
  targetTone = 1,
  detectedTone,
  targetPinyin = 'mā',
  hanzi = '妈',
  onPlayTargetAudio,
  onPlayUserAudio,
}) => {
  const toneInfo = TONE_NAMES[targetTone] || TONE_NAMES[1];
  const detectedToneNum = detectedTone ?? null;
  const isMatch = detectedToneNum === targetTone;

  // Normalizar el contorno del usuario al sistema de 5 niveles de Chao (1-5)
  const userPoints = useMemo(() => {
    if (!pitchContour || pitchContour.length === 0) return [];

    const voiced = pitchContour.filter((p) => p.isVoiced && p.f0Hz > 60 && p.f0Hz < 400);
    if (voiced.length === 0) return [];

    const pitches = voiced.map((p) => p.f0Hz);
    const minF0 = Math.min(...pitches);
    const maxF0 = Math.max(...pitches);
    const range = Math.max(25, maxF0 - minF0);

    return voiced.map((p, idx) => {
      const x = (idx / (voiced.length - 1 || 1)) * 100;
      // Escala 1 (grave) a 5 (agudo)
      const chaoLevel = 1 + ((p.f0Hz - minF0) / range) * 4;
      return [x, Math.max(1, Math.min(5, chaoLevel))] as [number, number];
    });
  }, [pitchContour]);

  // Convertir puntos Chao (1-5) a coordenadas SVG (viewBox 0 0 500 240)
  // En SVG: Y=0 es arriba (Nivel 5), Y=200 es abajo (Nivel 1)
  const toSvgCoords = (pts: Array<[number, number]>) => {
    return pts
      .map(([x, y]) => {
        const svgX = 50 + (x / 100) * 400;
        const svgY = 200 - ((y - 1) / 4) * 160;
        return `${svgX.toFixed(1)},${svgY.toFixed(1)}`;
      })
      .join(' ');
  };

  const targetSvgPath = toSvgCoords(toneInfo.points);
  const userSvgPath = userPoints.length > 0 ? toSvgCoords(userPoints) : '';

  return (
    <div className="mandarin-tone-card">
      <div className="tone-header-row">
        <div className="tone-hanzi-block">
          <span className="hanzi-char">{hanzi}</span>
          <div className="pinyin-meta">
            <span className="pinyin-text">{targetPinyin}</span>
            <span className="tone-pill">Tono {targetTone}</span>
          </div>
        </div>

        <div className="tone-status-badge">
          {detectedToneNum !== null ? (
            isMatch ? (
              <span className="badge-pass">
                <CheckCircle2 size={16} /> Tono Correcto ({TONE_NAMES[detectedToneNum]?.name ?? `Tono ${detectedToneNum}`})
              </span>
            ) : (
              <span className="badge-error">
                <XCircle size={16} /> Desviación a Tono {detectedToneNum} ({TONE_NAMES[detectedToneNum]?.name ?? `Tono ${detectedToneNum}`})
              </span>
            )
          ) : (
            <span className="badge-wait">
              <Sparkles size={16} /> Esperando audio para análisis F0
            </span>
          )}
        </div>
      </div>

      <p className="tone-description-text">
        <strong>{toneInfo.name}:</strong> {toneInfo.desc}
      </p>

      {/* Gráfica de Escala Tonal de Chao (Niveles 1 a 5) */}
      <div className="tone-canvas-container">
        <svg viewBox="0 0 500 240" className="tone-svg-chart">
          {/* Líneas horizontales de referencia Chao 1 - 5 */}
          {[5, 4, 3, 2, 1].map((level) => {
            const y = 200 - ((level - 1) / 4) * 160;
            return (
              <g key={level}>
                <line x1="50" y1={y} x2="450" y2={y} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="4 4" />
                <text x="35" y={y + 4} fill="#6b7280" fontSize="12" fontFamily="JetBrains Mono" textAnchor="end">
                  {level}
                </text>
              </g>
            );
          })}

          {/* Etiquetas del eje vertical */}
          <text x="15" y="44" fill="#9ca3af" fontSize="10" fontFamily="Inter" textAnchor="middle">
            Alto
          </text>
          <text x="15" y="204" fill="#9ca3af" fontSize="10" fontFamily="Inter" textAnchor="middle">
            Bajo
          </text>

          {/* Curva Canónica (Objetivo Nativo) */}
          <polyline
            points={targetSvgPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="target-contour-line"
          />

          {/* Curva Real del Usuario (F0 Pitch Tracker) */}
          {userSvgPath && (
            <polyline
              points={userSvgPath}
              fill="none"
              stroke={isMatch ? '#00f2fe' : '#ef4444'}
              strokeWidth="4"
              strokeDasharray={isMatch ? 'none' : '6 4'}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="user-contour-line"
            />
          )}

          {/* Puntos de muestra del usuario */}
          {userPoints.map(([x, y], idx) => {
            const svgX = 50 + (x / 100) * 400;
            const svgY = 200 - ((y - 1) / 4) * 160;
            return (
              <circle
                key={idx}
                cx={svgX}
                cy={svgY}
                r="3.5"
                fill={isMatch ? '#00f2fe' : '#ef4444'}
                stroke="#0a0b10"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>

        {/* Leyenda de la gráfica */}
        <div className="tone-legend-row">
          <div className="legend-item">
            <span className="legend-color-dot target" />
            <span>Tono Canónico Nativo ({toneInfo.contour})</span>
          </div>
          <div className="legend-item">
            <span className={`legend-color-dot user ${isMatch ? 'match' : 'mismatch'}`} />
            <span>Tu Contorno F0 {detectedTone ? `(Clasificado: Tono ${detectedToneNum})` : ''}</span>
          </div>
        </div>
      </div>

      {/* Controles de reproducción auditiva A/B */}
      <div className="tone-audio-actions">
        {onPlayTargetAudio && (
          <button className="tone-play-btn native" onClick={onPlayTargetAudio}>
            <Volume2 size={15} />
            <span>Escuchar Tono Nativo (Modelo)</span>
          </button>
        )}
        {onPlayUserAudio && (
          <button className="tone-play-btn user" onClick={onPlayUserAudio}>
            <Volume2 size={15} />
            <span>Escuchar Tu Pronunciación</span>
          </button>
        )}
      </div>
    </div>
  );
};
