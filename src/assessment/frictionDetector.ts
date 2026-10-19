/**
 * Detector de las 4 fricciones psicológicas del habla.
 * MyPolyGloty OS - Sprint 4
 *
 * Cada fricción se infiere de señales observables, nunca de autoinforme:
 *  - Ansiedad comunicativa: respuestas muy cortas respecto a lo pedido, abandono,
 *    disculpas/metacomentarios ("sorry, my English..."), volumen RMS bajo.
 *  - Sobrepensamiento gramatical: autocorrecciones y reinicios frecuentes con
 *    errores pocos o nulos (el alumno sabe, pero se frena).
 *  - Latencia de traducción mental: inicio de respuesta tardío + pausas largas
 *    intra-turno, con contenido aceptable una vez arranca.
 *  - Bloqueo fonético: puntuación fonética baja (motor Sprint 1) o evitación
 *    de palabras clave del enunciado.
 *
 * Las intensidades son 0-1 y se agregan como media sobre los turnos del diagnóstico.
 * Son indicadores para adaptar la pedagogía, no diagnósticos clínicos.
 */

import type { FrictionSignal, FrictionType, TurnFeatures, TurnTiming } from '../types/cefr';
import { norm } from './textFeatures';

const ANXIETY_MARKERS =
  /\b(sorry|my english is (bad|not good|poor)|i don't know|i can't explain|i'm nervous|perd[oó]n|no s[eé])\b/gi;

export interface FrictionTurnInput {
  answer: string;
  features: TurnFeatures;
  timing: TurnTiming;
  grammarErrorCount: number;
  /** Palabras mínimas esperadas por la sonda (A1 ≈ 6, C1 ≈ 45). */
  expectedMinWords: number;
}

export function detectTurnFrictions(t: FrictionTurnInput): Record<FrictionType, { v: number; ev: string[] }> {
  const { features: f, timing } = t;
  const out: Record<FrictionType, { v: number; ev: string[] }> = {
    'communicative-anxiety': { v: 0, ev: [] },
    'grammatical-overthinking': { v: 0, ev: [] },
    'translation-latency': { v: 0, ev: [] },
    'phonetic-block': { v: 0, ev: [] },
  };

  // --- Ansiedad comunicativa ---
  const shortfall = 1 - Math.min(1, f.wordCount / Math.max(1, t.expectedMinWords));
  const anxietyMarkers = t.answer.match(ANXIETY_MARKERS)?.length ?? 0;
  const anx = Math.min(1, 0.6 * shortfall + 0.25 * Math.min(2, anxietyMarkers));
  out['communicative-anxiety'].v = anx;
  if (shortfall > 0.4) out['communicative-anxiety'].ev.push(`Respuesta de ${f.wordCount} palabras (esperadas ≥${t.expectedMinWords})`);
  if (anxietyMarkers) out['communicative-anxiety'].ev.push(`${anxietyMarkers} metacomentario(s) de inseguridad`);

  // --- Sobrepensamiento gramatical ---
  const correctionsPer20 = f.wordCount ? (f.selfCorrections * 20) / f.wordCount : 0;
  const overthink = norm(correctionsPer20, 0.3, 2) * (t.grammarErrorCount === 0 ? 1 : 0.6);
  out['grammatical-overthinking'].v = overthink;
  if (f.selfCorrections > 0) {
    out['grammatical-overthinking'].ev.push(
      `${f.selfCorrections} autocorrección(es)${t.grammarErrorCount === 0 ? ' sin errores residuales' : ''}`
    );
  }

  // --- Latencia de traducción mental ---
  if (timing.responseOnsetMs != null || timing.longPauseCount != null) {
    const onset = norm(timing.responseOnsetMs ?? 0, 1200, 4500);
    const pauses = norm(timing.longPauseCount ?? 0, 0, 4);
    out['translation-latency'].v = 0.6 * onset + 0.4 * pauses;
    if (timing.responseOnsetMs != null && timing.responseOnsetMs > 1200) {
      out['translation-latency'].ev.push(`Inicio de respuesta a ${(timing.responseOnsetMs / 1000).toFixed(1)} s`);
    }
    if (timing.longPauseCount) out['translation-latency'].ev.push(`${timing.longPauseCount} pausa(s) > 600 ms`);
  } else {
    // Sin audio: proxy débil = muletillas de relleno.
    const fillerRate = f.wordCount ? f.filledPauses / f.wordCount : 0;
    out['translation-latency'].v = 0.5 * norm(fillerRate, 0.02, 0.12);
    if (f.filledPauses) out['translation-latency'].ev.push(`${f.filledPauses} muletilla(s) (proxy sin audio)`);
  }

  // --- Bloqueo fonético ---
  if (timing.phoneticScore != null) {
    out['phonetic-block'].v = 1 - norm(timing.phoneticScore, 45, 85);
    if (timing.phoneticScore < 70) out['phonetic-block'].ev.push(`Precisión fonética media ${timing.phoneticScore}%`);
  }

  return out;
}

export function aggregateFrictions(perTurn: Array<ReturnType<typeof detectTurnFrictions>>): FrictionSignal[] {
  const types: FrictionType[] = [
    'communicative-anxiety',
    'grammatical-overthinking',
    'translation-latency',
    'phonetic-block',
  ];
  return types.map((type) => {
    const vals = perTurn.map((p) => p[type].v);
    const intensity = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const evidence = Array.from(new Set(perTurn.flatMap((p) => p[type].ev))).slice(0, 4);
    return { type, intensity: Math.round(intensity * 100) / 100, evidence };
  });
}

export const FRICTION_LABELS: Record<FrictionType, { name: string; remedy: string }> = {
  'communicative-anxiety': {
    name: 'Ansiedad comunicativa',
    remedy: 'Turnos cortos de baja presión, elogio específico y correcciones diferidas al final de la sesión.',
  },
  'grammatical-overthinking': {
    name: 'Sobrepensamiento gramatical',
    remedy: 'Ejercicios de fluidez cronometrados donde se prohíbe autocorregirse; feedback gramatical solo después.',
  },
  'translation-latency': {
    name: 'Latencia de traducción mental',
    remedy: 'Bloques léxicos (chunks) prefabricados y shadowing para automatizar respuestas sin pasar por L1.',
  },
  'phonetic-block': {
    name: 'Bloqueo fonético',
    remedy: 'Drills dirigidos a los fonemas fallidos con el comparador del Sprint 5 antes de la conversación libre.',
  },
};
