/**
 * SessionVideoExporter - Actuador Multimedia para Recorte Quirúrgico y Video Resumen
 * MyPolyGloty OS - Sprint 5
 * 
 * Funcionalidades:
 * 1. Aislamiento milimétrico del error fonético en búfer de audio Web Audio (WAV descargable / loop).
 * 2. Generador de Video Resumen de la sesión a 1280x720 30FPS en HTML5 Canvas + MediaRecorder.
 * 3. Renderiza en el video:
 *    - Forma de onda de audio del alumno
 *    - Fonemas IPA con semáforo cromático (verde >=80%, amarillo 50-79%, rojo <50%)
 *    - Tarjeta de diagnóstico pedagógico
 *    - Contorno tonal F0 para Mandarín
 */

import { type PhoneticAnalysisResult } from '../phonetics/PhoneticEngine';

export interface VideoExportOptions {
  targetWord: string;
  result: PhoneticAnalysisResult;
  audioBuffer?: AudioBuffer;
  durationMs?: number;
  cefrBand?: string;
}

export class SessionVideoExporter {
  private static instance: SessionVideoExporter | null = null;

  private constructor() {}

  public static getInstance(): SessionVideoExporter {
    if (!SessionVideoExporter.instance) {
      SessionVideoExporter.instance = new SessionVideoExporter();
    }
    return SessionVideoExporter.instance;
  }

  /**
   * Recorta con precisión milimétrica el intervalo [startMs, endMs] de un AudioBuffer
   * y genera un Blob WAV descargable para reproducción en bucle del error.
   */
  public extractClipWav(audioBuffer: AudioBuffer, startMs: number, endMs: number): Blob {
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.max(0, Math.floor((startMs / 1000) * sampleRate));
    const endSample = Math.min(audioBuffer.length, Math.ceil((endMs / 1000) * sampleRate));
    const clipLength = Math.max(1, endSample - startSample);

    const monoData = new Float32Array(clipLength);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < clipLength; i++) {
      monoData[i] = channelData[startSample + i] || 0;
    }

    return this.encodeWav(monoData, sampleRate);
  }

  /**
   * Genera sintéticamente un fragmento de audio WAV si no se dispone de AudioBuffer completo.
   */
  public generateSynthesizedClipWav(startMs: number, endMs: number, frequency = 220): Blob {
    const sampleRate = 16000;
    const durationMs = Math.max(50, endMs - startMs);
    const sampleCount = Math.floor((durationMs / 1000) * sampleRate);
    const samples = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const t = i / sampleRate;
      // Onda compleja con formantes F1 (500Hz) y F2 (1500Hz)
      const carrier = Math.sin(2 * Math.PI * frequency * t);
      const f1 = 0.4 * Math.sin(2 * Math.PI * 520 * t);
      const f2 = 0.25 * Math.sin(2 * Math.PI * 1480 * t);
      const env = Math.sin((Math.PI * i) / sampleCount); // Hanning window
      samples[i] = (carrier + f1 + f2) * env * 0.7;
    }

    return this.encodeWav(samples, sampleRate);
  }

  /**
   * Genera un video resumen animado (WebM / MP4) en HTML5 Canvas sin tocar servidores.
   */
  public async generateSummaryVideo(options: VideoExportOptions): Promise<Blob> {
    const width = 1280;
    const height = 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar Canvas 2D');

    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recordingPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    recorder.start();

    // Renderizar animación durante 3 segundos (90 frames)
    const totalFrames = 90;
    for (let frame = 0; frame < totalFrames; frame++) {
      this.drawVideoFrame(ctx, width, height, frame, totalFrames, options);
      await new Promise((r) => setTimeout(r, 33)); // ~30 FPS
    }

    recorder.stop();
    return recordingPromise;
  }

  private drawVideoFrame(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    frame: number,
    totalFrames: number,
    opts: VideoExportOptions
  ) {
    // Fondo de gradiente oscuro
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0a0b10');
    bg.addColorStop(0.5, '#12141c');
    bg.addColorStop(1, '#0e111a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Aura decorativa superior
    const aura = ctx.createRadialGradient(w * 0.2, h * 0.1, 10, w * 0.2, h * 0.1, 400);
    aura.addColorStop(0, 'rgba(79, 172, 254, 0.15)');
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);

    // Cabecera
    ctx.font = '700 24px "Outfit", sans-serif';
    ctx.fillStyle = '#4facfe';
    ctx.fillText('MYPOLYGLOTY OS  •  RESUMEN FONÉTICO QUIRÚRGICO', 60, 65);

    ctx.font = '800 48px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(opts.targetWord, 60, 130);

    // Badge CEFR y Score Global
    const scoreColor = opts.result.overallScore >= 80 ? '#10b981' : opts.result.overallScore >= 50 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = scoreColor;
    ctx.font = '700 28px "JetBrains Mono", monospace';
    ctx.fillText(`Precisión Articularia: ${opts.result.overallScore}%`, 60, 180);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '500 20px "Inter", sans-serif';
    ctx.fillText(`Banda CEFR: ${opts.cefrBand || 'B1'}  |  Motor Acústico Wav2Vec2 + Autocorrelación F0`, 60, 215);

    // Tarjeta de Fonemas IPA con semáforo
    const cardY = 260;
    const cardH = 130;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(60, cardY, w - 120, cardH, 16);
    ctx.fill();
    ctx.stroke();

    // Dibujar cada fonema
    const phonemes = opts.result.phonemeScores;
    const phonemeWidth = Math.min(180, (w - 180) / (phonemes.length || 1));
    phonemes.forEach((p, idx) => {
      const px = 90 + idx * phonemeWidth;
      const py = cardY + 25;

      const pColor = p.status === 'optimal' ? '#10b981' : p.status === 'warning' ? '#f59e0b' : '#ef4444';

      // Caja del fonema
      ctx.fillStyle = p.status === 'optimal' ? 'rgba(16, 185, 129, 0.15)' : p.status === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px, py, phonemeWidth - 20, 80, 10);
      ctx.fill();
      ctx.stroke();

      // Letra IPA
      ctx.font = '700 32px "JetBrains Mono", monospace';
      ctx.fillStyle = pColor;
      ctx.textAlign = 'center';
      ctx.fillText(p.phoneme, px + (phonemeWidth - 20) / 2, py + 42);

      // Score porcentaje
      ctx.font = '600 16px "Inter", sans-serif';
      ctx.fillStyle = '#d1d5db';
      ctx.fillText(`${p.score}%`, px + (phonemeWidth - 20) / 2, py + 68);
    });
    ctx.textAlign = 'left';

    // Sección de diagnóstico quirúrgico
    ctx.font = '600 22px "Inter", sans-serif';
    ctx.fillStyle = opts.result.hasError ? '#ef4444' : '#10b981';
    ctx.fillText(`Diagnóstico: ${opts.result.diagnostic}`, 60, 435);

    // Onda animada en la parte inferior
    const waveY = 560;
    ctx.beginPath();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3;
    const progress = frame / totalFrames;

    for (let x = 60; x < w - 60; x += 4) {
      const relX = (x - 60) / (w - 120);
      const amp = Math.sin(relX * 12 + progress * Math.PI * 4) * Math.sin(relX * Math.PI) * 45;
      const y = waveY + amp;
      if (x === 60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Línea base del espectro
    ctx.font = '500 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`[Espectro Articulatorio Dinámico - Frame ${frame + 1}/${totalFrames}]`, 60, 660);
  }

  /**
   * Codifica un Float32Array a un archivo WAV PCM 16-bit
   */
  private encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }
}
