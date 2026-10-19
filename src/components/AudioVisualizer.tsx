import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, ShieldCheck, Cpu } from 'lucide-react';

interface AudioVisualizerProps {
  isRecording: boolean;
  isSpeaking: boolean;
  currentRms: number;
  sampleRate: number;
  samplesReceived: number;
  onToggleRecord: () => void;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  isSpeaking,
  currentRms,
  sampleRate,
  samplesReceived,
  onToggleRecord,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rmsHistory = useRef<number[]>(new Array(40).fill(0));

  useEffect(() => {
    // Desplazar historial de RMS
    rmsHistory.current.push(currentRms);
    rmsHistory.current.shift();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Fondo sutil con rejilla
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Dibujar barras de energía simétricas
    const barWidth = width / rmsHistory.current.length;
    const centerY = height / 2;

    rmsHistory.current.forEach((rms, i) => {
      const normalizedHeight = Math.min(height / 2, Math.max(2, rms * height * 4));
      const x = i * barWidth;

      // Color degradado dinámico según si hay habla o no
      const gradient = ctx.createLinearGradient(0, centerY - normalizedHeight, 0, centerY + normalizedHeight);
      if (isSpeaking) {
        gradient.addColorStop(0, '#00f2fe');
        gradient.addColorStop(0.5, '#4facfe');
        gradient.addColorStop(1, '#00f2fe');
      } else if (isRecording) {
        gradient.addColorStop(0, '#38ef7d');
        gradient.addColorStop(0.5, '#11998e');
        gradient.addColorStop(1, '#38ef7d');
      } else {
        gradient.addColorStop(0, '#555566');
        gradient.addColorStop(1, '#333344');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x + 1, centerY - normalizedHeight, barWidth - 2, normalizedHeight * 2);
    });
  }, [currentRms, isSpeaking, isRecording]);

  return (
    <div className="audio-visualizer-card">
      <div className="visualizer-header">
        <div className="visualizer-status">
          <div className={`status-dot ${isRecording ? (isSpeaking ? 'speaking' : 'listening') : 'idle'}`} />
          <span className="status-label">
            {isRecording
              ? isSpeaking
                ? 'Hablando detectado (VAD Activo)'
                : 'Escuchando en silencio...'
              : 'Micrófono Inactivo'}
          </span>
        </div>

        <div className="visualizer-tech-tags">
          <span className="tech-tag">
            <Cpu size={12} /> AudioWorklet 16kHz Mono
          </span>
          <span className="tech-tag">
            <ShieldCheck size={12} /> AEC + NS Activo
          </span>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas ref={canvasRef} width={500} height={100} className="audio-canvas" />
      </div>

      <div className="visualizer-controls">
        <button
          className={`mic-toggle-btn ${isRecording ? 'recording' : ''}`}
          onClick={onToggleRecord}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          <span>{isRecording ? 'Detener Captura' : 'Iniciar Captura PCM'}</span>
        </button>

        <div className="audio-metrics-row">
          <div className="audio-metric">
            <Volume2 size={14} className="metric-icon" />
            <span className="metric-title">Nivel RMS:</span>
            <span className="metric-data">{(currentRms * 100).toFixed(1)}%</span>
          </div>

          <div className="audio-metric">
            <span className="metric-title">Tasa de Muestreo:</span>
            <span className="metric-data">{sampleRate} Hz</span>
          </div>

          <div className="audio-metric">
            <span className="metric-title">Muestras:</span>
            <span className="metric-data">{(samplesReceived / 1000).toFixed(1)}k</span>
          </div>
        </div>
      </div>
    </div>
  );
};
