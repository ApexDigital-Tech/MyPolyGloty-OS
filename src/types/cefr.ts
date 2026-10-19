/**
 * Tipos y esquemas Zod para el Diagnóstico CEFR en 6 bandas y la detección de fricciones.
 * MyPolyGloty OS - Sprint 4
 *
 * NOTA DE HONESTIDAD METODOLÓGICA:
 * El diagnóstico combina rasgos lingüísticos medibles (diversidad léxica, complejidad
 * sintáctica, sofisticación léxica, fluidez temporal) con un evaluador LLM opcional.
 * NO es un examen CEFR certificado; es una estimación de colocación inicial con
 * intervalo de confianza explícito.
 */

import { z } from 'zod';

export const CEFR_BANDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const CefrBandSchema = z.enum(CEFR_BANDS);
export type CefrBand = z.infer<typeof CefrBandSchema>;

/** Rasgos medidos sobre la respuesta de un turno. */
export const TurnFeaturesSchema = z.object({
  wordCount: z.number().int().nonnegative(),
  sentenceCount: z.number().int().nonnegative(),
  meanSentenceLength: z.number().nonnegative(),
  /** Moving-Average Type-Token Ratio (ventana 25) — robusto en textos cortos. */
  mattr: z.number().min(0).max(1),
  /** Proporción de palabras fuera del núcleo léxico de alta frecuencia. */
  lexicalSophistication: z.number().min(0).max(1),
  meanWordLength: z.number().nonnegative(),
  /** Marcadores de subordinación por oración (because, although, which...). */
  subordinationPerSentence: z.number().nonnegative(),
  /** Conectores discursivos avanzados (however, nevertheless, whereas...). */
  advancedConnectors: z.number().int().nonnegative(),
  /** Variedad de formas verbales detectadas (pasado, perfecto, condicional, pasiva, modal). */
  verbFormVariety: z.number().int().nonnegative(),
  filledPauses: z.number().int().nonnegative(),
  selfCorrections: z.number().int().nonnegative(),
  /** Palabras por minuto, si se dispone de la duración del habla. */
  wordsPerMinute: z.number().nonnegative().nullable(),
});
export type TurnFeatures = z.infer<typeof TurnFeaturesSchema>;

/** Señales temporales del turno capturadas por el AudioEngine / VAD. */
export const TurnTimingSchema = z.object({
  /** Tiempo desde que termina la pregunta del tutor hasta el inicio de voz del alumno. */
  responseOnsetMs: z.number().nonnegative().nullable(),
  /** Duración del habla activa del alumno. */
  speechDurationMs: z.number().nonnegative().nullable(),
  /** Número de pausas intra-turno > 600 ms. */
  longPauseCount: z.number().int().nonnegative().nullable(),
  /** Puntuación fonética media del motor del Sprint 1 (0-100), si existe. */
  phoneticScore: z.number().min(0).max(100).nullable(),
});
export type TurnTiming = z.infer<typeof TurnTimingSchema>;

export const FRICTION_TYPES = [
  'communicative-anxiety',
  'grammatical-overthinking',
  'translation-latency',
  'phonetic-block',
] as const;
export type FrictionType = (typeof FRICTION_TYPES)[number];

export interface FrictionSignal {
  type: FrictionType;
  /** 0 = ausente, 1 = muy marcada. */
  intensity: number;
  evidence: string[];
}

/** Sonda de diagnóstico: una pregunta con una banda objetivo. */
export interface DiagnosticProbe {
  id: string;
  targetBand: CefrBand;
  /** Qué competencia sondea (descripción, narración en pasado, hipótesis...). */
  skill: string;
  prompt: string;
  /** Pistas de expectativa para el evaluador LLM. */
  expectation: string;
}

export interface TurnAssessment {
  probe: DiagnosticProbe;
  answer: string;
  features: TurnFeatures;
  timing: TurnTiming;
  /** Puntuación heurística continua 0-100 (0 = pre-A1, 100 = C2 alto). */
  heuristicScore: number;
  /** Puntuación del evaluador LLM, si hubo clave BYOK disponible. */
  llmScore: number | null;
  llmRationale: string | null;
  /** Puntuación combinada usada para el ajuste adaptativo. */
  combinedScore: number;
  estimatedBand: CefrBand;
}

export interface DiagnosticResult {
  band: CefrBand;
  /** Puntuación final 0-100. */
  score: number;
  /** Intervalo de bandas plausible (ej. B1–B2). */
  confidenceRange: [CefrBand, CefrBand];
  /** 0-1: baja cuando los turnos discrepan mucho o son muy cortos. */
  confidence: number;
  subScores: {
    range: number;      // diversidad + sofisticación léxica
    accuracy: number;   // aproximación por autocorrecciones / LLM
    complexity: number; // subordinación, conectores, formas verbales
    fluency: number;    // ppm, pausas, latencia de inicio
  };
  frictions: FrictionSignal[];
  turns: TurnAssessment[];
  method: 'heuristic' | 'heuristic+llm';
  completedAt: number;
}

/**
 * Mapeo puntuación continua → banda.
 * Calibrado sobre scripts/run_cefr_calibration.ts (16 textos redactados a mano).
 * Es un ajuste in-sample: con solo texto, C1 y C2 se separan mal; el evaluador
 * LLM y la señal de audio son los que deben resolver la parte alta.
 */
export const BAND_THRESHOLDS: Array<{ band: CefrBand; min: number }> = [
  { band: 'C2', min: 88 },
  { band: 'C1', min: 76 },
  { band: 'B2', min: 64 },
  { band: 'B1', min: 36 },
  { band: 'A2', min: 15 },
  { band: 'A1', min: 0 },
];

export function scoreToBand(score: number): CefrBand {
  for (const t of BAND_THRESHOLDS) {
    if (score >= t.min) return t.band;
  }
  return 'A1';
}

export function bandIndex(band: CefrBand): number {
  return CEFR_BANDS.indexOf(band);
}

export function bandFromIndex(i: number): CefrBand {
  return CEFR_BANDS[Math.max(0, Math.min(CEFR_BANDS.length - 1, Math.round(i)))];
}
