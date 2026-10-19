import React, { useEffect, useRef } from 'react';
import { TtsService } from '../services/ttsService';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ParametricAvatar2DProps {
  status: AvatarState;
  userRms?: number;
  width?: number;
  height?: number;
}

export const ParametricAvatar2D: React.FC<ParametricAvatar2DProps> = ({
  status,
  userRms = 0,
  width = 160,
  height = 160,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Estados de animación estocásticos
  const blinkProgress = useRef<number>(0);
  const nextBlinkTime = useRef<number>(Date.now() + 2500);
  const breathingPhase = useRef<number>(0);
  const mouthOpenness = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tts = TtsService.getInstance();
    const analyser = tts.getAnalyser();
    const freqData = new Uint8Array(analyser ? analyser.frequencyBinCount : 32);

    const render = () => {
      const now = Date.now();
      ctx.clearRect(0, 0, width, height);

      // 1. Manejo del parpadeo de ojos (Blink)
      if (now > nextBlinkTime.current) {
        blinkProgress.current += 0.2;
        if (blinkProgress.current >= 1) {
          blinkProgress.current = 0;
          nextBlinkTime.current = now + 2800 + Math.random() * 2500;
        }
      }

      // 2. Respiración sutil
      breathingPhase.current += 0.04;
      const breathOffset = Math.sin(breathingPhase.current) * 2;

      // 3. Apertura de boca guiada por audio del AnalyserNode o userRms
      let audioEnergy = 0;
      if (status === 'speaking' && analyser) {
        analyser.getByteFrequencyData(freqData);
        // Promedio de frecuencias vocálicas (bins 2 a 16)
        let sum = 0;
        for (let i = 2; i < 16; i++) {
          sum += freqData[i];
        }
        audioEnergy = (sum / 14) / 255.0; // 0.0 a 1.0
      } else if (status === 'listening') {
        audioEnergy = Math.min(1.0, userRms * 3.5);
      }

      // Suavizado de apertura de boca (interpolar hacia audioEnergy)
      mouthOpenness.current = mouthOpenness.current * 0.65 + audioEnergy * 0.35;

      const centerX = width / 2;
      const centerY = height / 2 + breathOffset;
      const radius = width * 0.38;

      // --- Halo Perimetral de Estado (Glow Ring) ---
      let haloColor = 'rgba(107, 114, 128, 0.2)';
      let shadowGlow = 'rgba(107, 114, 128, 0.4)';

      if (status === 'speaking') {
        haloColor = 'rgba(0, 242, 254, 0.35)';
        shadowGlow = 'rgba(0, 242, 254, 0.7)';
      } else if (status === 'listening') {
        haloColor = 'rgba(16, 185, 129, 0.35)';
        shadowGlow = 'rgba(16, 185, 129, 0.7)';
      } else if (status === 'thinking') {
        haloColor = 'rgba(121, 40, 202, 0.35)';
        shadowGlow = 'rgba(121, 40, 202, 0.7)';
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = haloColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = shadowGlow;
      ctx.shadowBlur = 12 + audioEnergy * 15;
      ctx.stroke();
      ctx.restore();

      // --- Cabeza / Rostro ---
      ctx.save();
      const headGrad = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.1,
        centerX,
        centerY,
        radius
      );
      headGrad.addColorStop(0, '#2d3345');
      headGrad.addColorStop(0.7, '#1b1e2a');
      headGrad.addColorStop(1, '#11131c');

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = headGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // --- Ojos Paramétricos ---
      const eyeSpacing = radius * 0.42;
      const eyeY = centerY - radius * 0.15;
      const eyeRadiusX = radius * 0.14;
      // Parpadeo modula la altura del ojo
      const blinkFactor = blinkProgress.current > 0 ? Math.sin(blinkProgress.current * Math.PI) : 0;
      const eyeRadiusY = Math.max(1, radius * 0.14 * (1 - blinkFactor * 0.9));

      // Desplazamiento de mirada según estado
      let pupilShiftX = 0;
      let pupilShiftY = 0;
      if (status === 'thinking') {
        pupilShiftX = Math.sin(now * 0.003) * 4;
        pupilShiftY = -2;
      } else if (status === 'listening') {
        pupilShiftY = 2; // Mirando hacia el usuario
      }

      // Ojo Izquierdo
      drawEye(ctx, centerX - eyeSpacing, eyeY, eyeRadiusX, eyeRadiusY, pupilShiftX, pupilShiftY, status);
      // Ojo Derecho
      drawEye(ctx, centerX + eyeSpacing, eyeY, eyeRadiusX, eyeRadiusY, pupilShiftX, pupilShiftY, status);

      // --- Cejas Expresivas ---
      drawEyebrows(ctx, centerX, eyeY, eyeSpacing, radius, status);

      // --- Boca Paramétrica (Lip-Flap) ---
      const mouthY = centerY + radius * 0.42;
      const maxMouthHeight = radius * 0.35;
      const currentHeight = Math.max(3, mouthOpenness.current * maxMouthHeight);
      const mouthWidth = radius * 0.48;

      ctx.save();
      ctx.beginPath();
      if (currentHeight <= 4) {
        // Boca cerrada: Sonrisa natural sutil
        ctx.moveTo(centerX - mouthWidth / 2, mouthY);
        ctx.quadraticCurveTo(centerX, mouthY + 3, centerX + mouthWidth / 2, mouthY);
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        // Boca abierta modulada por fonemas
        ctx.ellipse(centerX, mouthY, mouthWidth / 2, currentHeight / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#0f1118';
        ctx.fill();
        ctx.strokeStyle = '#4facfe';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dientes / Lengua sutil
        ctx.beginPath();
        ctx.arc(centerX, mouthY + currentHeight * 0.2, mouthWidth * 0.25, 0, Math.PI);
        ctx.fillStyle = '#f87171';
        ctx.fill();
      }
      ctx.restore();

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [status, userRms, width, height]);

  // Dibujar un ojo con iris y pupila
  const drawEye = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rx: number,
    ry: number,
    shiftX: number,
    shiftY: number,
    state: AvatarState
  ) => {
    ctx.save();
    // Esclera (Blanco de ojo sutil)
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();

    if (ry > 3) {
      // Iris con color dinámico
      ctx.beginPath();
      const irisColor = state === 'speaking' ? '#00f2fe' : state === 'listening' ? '#10b981' : '#818cf8';
      ctx.arc(x + shiftX, y + shiftY, rx * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = irisColor;
      ctx.fill();

      // Pupila negra
      ctx.beginPath();
      ctx.arc(x + shiftX, y + shiftY, rx * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#090a0f';
      ctx.fill();

      // Brillo especular
      ctx.beginPath();
      ctx.arc(x + shiftX - rx * 0.2, y + shiftY - rx * 0.2, rx * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  };

  // Dibujar cejas con ángulos expresivos
  const drawEyebrows = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    eyeY: number,
    eyeSpacing: number,
    radius: number,
    state: AvatarState
  ) => {
    ctx.save();
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    const browY = eyeY - radius * 0.22;
    const browLength = radius * 0.26;

    let tilt = 0;
    if (state === 'listening') tilt = 2; // Curiosidad/atención
    if (state === 'thinking') tilt = -3; // Concentración

    // Ceja Izquierda
    ctx.beginPath();
    ctx.moveTo(centerX - eyeSpacing - browLength / 2, browY + tilt);
    ctx.lineTo(centerX - eyeSpacing + browLength / 2, browY - tilt);
    ctx.stroke();

    // Ceja Derecha
    ctx.beginPath();
    ctx.moveTo(centerX + eyeSpacing - browLength / 2, browY - tilt);
    ctx.lineTo(centerX + eyeSpacing + browLength / 2, browY + tilt);
    ctx.stroke();

    ctx.restore();
  };

  return (
    <div className={`avatar-2d-frame ${status}`} title={`Avatar Alistair Vance (Estado: ${status})`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="avatar-2d-canvas"
      />
    </div>
  );
};
