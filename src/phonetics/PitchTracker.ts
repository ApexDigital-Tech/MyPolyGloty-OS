/**
 * PitchTracker - Extractor de Frecuencia Fundamental (F0) y Clasificador de Tonos en Mandarín
 * MyPolyGloty OS - Sprint 1 (Spike Fonético)
 * 
 * Implementa detección de tono F0 mediante Autocorrelación Normalizada y análisis de pendientes
 * para los 4 tonos canónicos del chino mandarín + tono neutro.
 */

export interface PitchFrame {
  timestampMs: number;
  f0Hz: number;
  isVoiced: boolean;
  energy: number;
}

export type MandarinTone = 1 | 2 | 3 | 4 | 5; // 1: mā, 2: má, 3: mǎ, 4: mà, 5: de (neutro)

export interface ToneEvaluationResult {
  detectedTone: MandarinTone;
  targetTone: MandarinTone;
  isCorrect: boolean;
  score: number; // 0 - 100%
  meanF0Hz: number;
  pitchSlope: number; // Semitonos / seg
  pitchContour: PitchFrame[];
  diagnostic: string;
}

export class PitchTracker {
  private sampleRate: number;
  private frameSize: number; // e.g. 512 muestras = 32ms a 16kHz
  private hopSize: number;   // e.g. 160 muestras = 10ms a 16kHz
  private minF0: number = 75;  // Hz (Límite inferior para voz humana)
  private maxF0: number = 400; // Hz (Límite superior para registro alto)

  constructor(sampleRate: number = 16000) {
    this.sampleRate = sampleRate;
    this.frameSize = Math.floor(sampleRate * 0.032); // 32 ms
    this.hopSize = Math.floor(sampleRate * 0.010);   // 10 ms
  }

  /**
   * Extrae la curva de F0 a lo largo del tiempo de un búfer PCM Float32 o Int16.
   */
  public extractContour(samples: Float32Array | Int16Array): PitchFrame[] {
    // Normalizar a Float32 [-1.0, 1.0] si es Int16
    let floatSamples: Float32Array;
    if (samples instanceof Int16Array) {
      floatSamples = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        floatSamples[i] = samples[i] / 32768.0;
      }
    } else {
      floatSamples = samples;
    }

    const contour: PitchFrame[] = [];
    const minPeriod = Math.floor(this.sampleRate / this.maxF0);
    const maxPeriod = Math.floor(this.sampleRate / this.minF0);

    for (let offset = 0; offset + this.frameSize <= floatSamples.length; offset += this.hopSize) {
      const frame = floatSamples.subarray(offset, offset + this.frameSize);
      const timestampMs = Math.round((offset / this.sampleRate) * 1000);

      // Calcular energía RMS del fotograma
      let sumSq = 0;
      for (let i = 0; i < frame.length; i++) {
        sumSq += frame[i] * frame[i];
      }
      const rms = Math.sqrt(sumSq / frame.length);

      if (rms < 0.015) {
        // Silencio o fricativa sorda
        contour.push({ timestampMs, f0Hz: 0, isVoiced: false, energy: rms });
        continue;
      }

      // Autocorrelación normalizada para detectar periodicidad
      let bestCorrelation = -1;
      let bestPeriod = -1;

      for (let lag = minPeriod; lag <= maxPeriod; lag++) {
        let correlation = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < this.frameSize - lag; i++) {
          correlation += frame[i] * frame[i + lag];
          normA += frame[i] * frame[i];
          normB += frame[i + lag] * frame[i + lag];
        }

        const denom = Math.sqrt(normA * normB);
        if (denom > 0) {
          const r = correlation / denom;
          if (r > bestCorrelation) {
            bestCorrelation = r;
            bestPeriod = lag;
          }
        }
      }

      // Si la autocorrelación es alta (>0.55), es un segmento sonoro periódico (vocal)
      if (bestCorrelation > 0.55 && bestPeriod > 0) {
        const f0 = this.sampleRate / bestPeriod;
        contour.push({ timestampMs, f0Hz: Math.round(f0), isVoiced: true, energy: rms });
      } else {
        contour.push({ timestampMs, f0Hz: 0, isVoiced: false, energy: rms });
      }
    }

    return contour;
  }

  /**
   * Clasifica el contorno tonal y lo compara con el tono canónico del Mandarín.
   */
  public evaluateMandarinTone(
    samples: Float32Array | Int16Array,
    targetTone: MandarinTone
  ): ToneEvaluationResult {
    const contour = this.extractContour(samples);
    const voicedFrames = contour.filter((f) => f.isVoiced && f.f0Hz > 0);

    if (voicedFrames.length < 3) {
      return {
        detectedTone: 5,
        targetTone,
        isCorrect: targetTone === 5,
        score: targetTone === 5 ? 85 : 30,
        meanF0Hz: 0,
        pitchSlope: 0,
        pitchContour: contour,
        diagnostic: 'Audio con energía vocal insuficiente para medir contorno F0.',
      };
    }

    // Extraer estadísticas de F0
    const f0Values = voicedFrames.map((f) => f.f0Hz);
    const meanF0 = f0Values.reduce((a, b) => a + b, 0) / f0Values.length;
    const firstHalfF0 = f0Values.slice(0, Math.floor(f0Values.length / 2));
    const secondHalfF0 = f0Values.slice(Math.floor(f0Values.length / 2));

    const avgFirst = firstHalfF0.reduce((a, b) => a + b, 0) / (firstHalfF0.length || 1);
    const avgSecond = secondHalfF0.reduce((a, b) => a + b, 0) / (secondHalfF0.length || 1);

    // Variación relativa en porcentaje
    const deltaSemitones = 12 * Math.log2(avgSecond / (avgFirst || 1));
    const durationMs = voicedFrames[voicedFrames.length - 1].timestampMs - voicedFrames[0].timestampMs;

    // Reglas acústicas de tonos chinos:
    // Tono 1: Plano, alto, semitonos ~ 0
    // Tono 2: Ascendente, delta > +2.5 semitonos
    // Tono 4: Descendente abrupto, delta < -3.0 semitonos
    // Tono 3: Desciende y sube, o bajo sostenido
    // Tono 5: Corto (<120ms) y bajo
    let detectedTone: MandarinTone = 1;

    if (durationMs < 120 && meanF0 < 170) {
      detectedTone = 5; // Neutro
    } else if (deltaSemitones > 2.5) {
      detectedTone = 2; // Ascendente
    } else if (deltaSemitones < -2.8) {
      detectedTone = 4; // Descendente abrupto
    } else {
      // Verificar si hay valle intermedio para Tono 3
      const minF0 = Math.min(...f0Values);
      const isDipping = minF0 < avgFirst - 15 && avgSecond > minF0 + 10;
      if (isDipping || meanF0 < 160) {
        detectedTone = 3; // Dip
      } else {
        detectedTone = 1; // Plano alto
      }
    }

    const isCorrect = detectedTone === targetTone;
    let score = isCorrect ? 90 + Math.floor(Math.random() * 8) : Math.max(20, Math.min(50, 50 - Math.abs(deltaSemitones) * 5));

    let diagnostic = '';
    if (isCorrect) {
      diagnostic = `Tono ${targetTone} pronunciado correctamente (Contorno F0 coincide con el estándar).`;
    } else {
      const toneNames: Record<MandarinTone, string> = {
        1: 'Tono 1 (Alto plano - 55)',
        2: 'Tono 2 (Ascendente - 35)',
        3: 'Tono 3 (Bajo/Descendente-ascendente - 214)',
        4: 'Tono 4 (Descendente abrupto - 51)',
        5: 'Tono 5 (Neutro ligero)',
      };
      diagnostic = `Desviación tonal: Se esperaba ${toneNames[targetTone]}, pero se detectó ${toneNames[detectedTone]} (Inclinación: ${deltaSemitones.toFixed(1)} st).`;
    }

    return {
      detectedTone,
      targetTone,
      isCorrect,
      score: Math.round(score),
      meanF0Hz: Math.round(meanF0),
      pitchSlope: Number(deltaSemitones.toFixed(2)),
      pitchContour: contour,
      diagnostic,
    };
  }
}
