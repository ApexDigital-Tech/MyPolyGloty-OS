/**
 * CefrDiagnosticEngine — Diagnóstico adaptativo en 5 turnos, 6 bandas (A1–C2).
 * MyPolyGloty OS - Sprint 4
 *
 * Algoritmo (inspirado en tests adaptativos tipo staircase):
 * 1. Turno 1 arranca con una sonda B1 (punto medio de la escala).
 * 2. Tras cada respuesta se calcula la puntuación combinada (heurística ± LLM).
 * 3. Si la respuesta supera el centro de la banda objetivo, la siguiente sonda sube
 *    una banda; si queda claramente por debajo, baja; si no, se sondea la misma banda
 *    con otra competencia.
 * 4. Resultado final: media ponderada (los turnos tardíos, más afinados, pesan más),
 *    con intervalo de confianza a partir de la dispersión entre turnos.
 */

import {
  CEFR_BANDS,
  bandFromIndex,
  bandIndex,
  scoreToBand,
  type CefrBand,
  type DiagnosticProbe,
  type DiagnosticResult,
  type TurnAssessment,
  type TurnTiming,
} from '../types/cefr';
import { extractFeatures, scoreHeuristic } from './textFeatures';
import { aggregateFrictions, detectTurnFrictions } from './frictionDetector';
import { ByokStorage } from '../services/byokStorage';

export const TOTAL_TURNS = 5;
const STORAGE_KEY = 'mypolygloty.cefr.lastResult';

const EXPECTED_MIN_WORDS: Record<CefrBand, number> = { A1: 6, A2: 15, B1: 25, B2: 35, C1: 45, C2: 55 };
const BAND_CENTER: Record<CefrBand, number> = { A1: 7, A2: 25, B1: 50, B2: 70, C1: 82, C2: 94 };

export const PROBE_BANK: DiagnosticProbe[] = [
  { id: 'a1-self', targetBand: 'A1', skill: 'Presentación personal', prompt: 'Hi! What is your name, and where are you from?', expectation: 'Frases simples aisladas sobre datos personales.' },
  { id: 'a1-day', targetBand: 'A1', skill: 'Rutina básica', prompt: 'What do you do every morning?', expectation: 'Presente simple, vocabulario cotidiano.' },
  { id: 'a2-weekend', targetBand: 'A2', skill: 'Narración en pasado simple', prompt: 'What did you do last weekend?', expectation: 'Pasado simple, conectores and/but/then.' },
  { id: 'a2-job', targetBand: 'A2', skill: 'Descripción de trabajo/estudios', prompt: 'Tell me about your job or your studies. What do you like about it?', expectation: 'Descripción con because, preferencias.' },
  { id: 'b1-experience', targetBand: 'B1', skill: 'Experiencia y opinión', prompt: 'Tell me about a trip or experience you remember well. Why was it special?', expectation: 'Narración coherente, pasado + opinión justificada.' },
  { id: 'b1-plans', targetBand: 'B1', skill: 'Planes y ambiciones', prompt: 'What would you like to achieve in the next few years, and how are you planning to get there?', expectation: 'Futuro, condicional simple, razones.' },
  { id: 'b2-problem', targetBand: 'B2', skill: 'Resolución de problemas', prompt: 'Describe a difficult problem you had to solve at work or in your studies. What did you do and what was the result?', expectation: 'Secuencia causa-efecto, perfecto, pasiva, conectores.' },
  { id: 'b2-debate', targetBand: 'B2', skill: 'Argumentación pros/contras', prompt: 'Do you think remote work is better than working in an office? Give arguments on both sides.', expectation: 'Contraste however/whereas, hipótesis.' },
  { id: 'c1-hypothetical', targetBand: 'C1', skill: 'Hipótesis sobre el pasado', prompt: 'Looking back, what is one important decision you would make differently, and how might things have turned out?', expectation: 'Condicional mixto/3er tipo, matiz, autoevaluación.' },
  { id: 'c1-abstract', targetBand: 'C1', skill: 'Tema abstracto', prompt: 'How do you think artificial intelligence will change the way people learn languages? Consider risks as well as benefits.', expectation: 'Registro formal, hedging, argumentación estructurada.' },
  { id: 'c2-nuance', targetBand: 'C2', skill: 'Matiz y precisión', prompt: 'Some people argue that technological progress is inherently neutral and only its use is good or bad. To what extent do you agree?', expectation: 'Precisión léxica, concesión, estructuras complejas sin esfuerzo.' },
  { id: 'c2-critique', targetBand: 'C2', skill: 'Crítica razonada', prompt: 'Think of a widely accepted idea in your field that you believe is overrated. Make the case against it.', expectation: 'Argumentación sofisticada, ironía/matiz, cohesión impecable.' },
];

export class CefrDiagnosticEngine {
  private turns: TurnAssessment[] = [];
  private frictionTurns: Array<ReturnType<typeof detectTurnFrictions>> = [];
  private usedProbeIds = new Set<string>();
  private currentProbe: DiagnosticProbe;

  constructor() {
    this.currentProbe = this.pickProbe('B1');
  }

  get turnIndex(): number {
    return this.turns.length;
  }

  get isComplete(): boolean {
    return this.turns.length >= TOTAL_TURNS;
  }

  get probe(): DiagnosticProbe {
    return this.currentProbe;
  }

  get history(): TurnAssessment[] {
    return [...this.turns];
  }

  private pickProbe(band: CefrBand): DiagnosticProbe {
    const candidates = PROBE_BANK.filter((p) => p.targetBand === band && !this.usedProbeIds.has(p.id));
    // Si ya se agotaron las de esa banda, tomar la banda adyacente más cercana sin usar.
    const fallback = PROBE_BANK.filter((p) => !this.usedProbeIds.has(p.id)).sort(
      (a, b) => Math.abs(bandIndex(a.targetBand) - bandIndex(band)) - Math.abs(bandIndex(b.targetBand) - bandIndex(band))
    );
    const probe = candidates[0] ?? fallback[0] ?? PROBE_BANK[0];
    this.usedProbeIds.add(probe.id);
    return probe;
  }

  async submitAnswer(answer: string, timing: TurnTiming): Promise<TurnAssessment> {
    if (this.isComplete) throw new Error('El diagnóstico ya está completo.');
    const probe = this.currentProbe;

    const features = extractFeatures(answer, timing);
    const h = scoreHeuristic(answer, features, timing);

    const llm = await rateWithLlm(probe, answer).catch(() => null);
    const combinedScore = llm ? Math.round(0.5 * h.total + 0.5 * llm.score) : h.total;

    const assessment: TurnAssessment = {
      probe,
      answer,
      features,
      timing,
      heuristicScore: h.total,
      llmScore: llm?.score ?? null,
      llmRationale: llm?.rationale ?? null,
      combinedScore,
      estimatedBand: scoreToBand(combinedScore),
    };
    this.turns.push(assessment);
    this.frictionTurns.push(
      detectTurnFrictions({
        answer,
        features,
        timing,
        grammarErrorCount: h.grammarErrors.length,
        expectedMinWords: EXPECTED_MIN_WORDS[probe.targetBand],
      })
    );

    if (!this.isComplete) {
      // Escalera adaptativa
      const target = probe.targetBand;
      const ti = bandIndex(target);
      let next: CefrBand;
      if (combinedScore >= BAND_CENTER[target]) next = bandFromIndex(ti + 1);
      else if (bandIndex(assessment.estimatedBand) < ti) next = bandFromIndex(ti - 1);
      else next = target;
      this.currentProbe = this.pickProbe(next);
    }
    return assessment;
  }

  finalize(): DiagnosticResult {
    if (this.turns.length === 0) throw new Error('No hay turnos que evaluar.');

    const weights = this.turns.map((_, i) => 1 + 0.25 * i);
    const wSum = weights.reduce((a, b) => a + b, 0);
    const scores = this.turns.map((t) => t.combinedScore);
    const mean = scores.reduce((a, s, i) => a + s * weights[i], 0) / wSum;
    const sd = Math.sqrt(scores.reduce((a, s, i) => a + weights[i] * (s - mean) ** 2, 0) / wSum);

    const band = scoreToBand(mean);
    const low = scoreToBand(Math.max(0, mean - sd));
    const high = scoreToBand(Math.min(100, mean + sd));

    const avgWords = this.turns.reduce((a, t) => a + t.features.wordCount, 0) / this.turns.length;
    const lengthFactor = Math.min(1, avgWords / 30);
    const confidence = Math.max(0.15, Math.min(0.95, (1 - sd / 30) * (0.5 + 0.5 * lengthFactor)));

    const sub = { range: 0, accuracy: 0, complexity: 0, fluency: 0 };
    for (const t of this.turns) {
      const h = scoreHeuristic(t.answer, t.features, t.timing);
      sub.range += h.range;
      sub.accuracy += h.accuracy;
      sub.complexity += h.complexity;
      sub.fluency += h.fluency;
    }
    const n = this.turns.length;

    const result: DiagnosticResult = {
      band,
      score: Math.round(mean),
      confidenceRange: [low, high],
      confidence: Math.round(confidence * 100) / 100,
      subScores: {
        range: Math.round(sub.range / n),
        accuracy: Math.round(sub.accuracy / n),
        complexity: Math.round(sub.complexity / n),
        fluency: Math.round(sub.fluency / n),
      },
      frictions: aggregateFrictions(this.frictionTurns),
      turns: this.history,
      method: this.turns.some((t) => t.llmScore !== null) ? 'heuristic+llm' : 'heuristic',
      completedAt: Date.now(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch {
      /* almacenamiento no disponible: no bloquea el diagnóstico */
    }
    return result;
  }

  static loadLastResult(): DiagnosticResult | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DiagnosticResult) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Evaluador LLM opcional (solo si hay clave Groq configurada en BYOK).
 * Devuelve null si no hay clave, si falla la red o si la respuesta no es válida;
 * el diagnóstico continúa entonces solo con la heurística.
 */
async function rateWithLlm(
  probe: DiagnosticProbe,
  answer: string
): Promise<{ score: number; rationale: string } | null> {
  const provider = ByokStorage.getInstance().getActiveProvider();
  const key = provider.apiKey;
  if (!key || !key.startsWith('gsk_')) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a certified CEFR oral examiner. Rate a learner\'s spoken answer (transcribed) on a 0-100 scale ' +
              'anchored as: A1=0-14, A2=15-35, B1=36-63, B2=64-75, C1=76-87, C2=88-100. ' +
              'Judge range, accuracy, coherence and task fulfilment. Do not reward length alone. ' +
              'Reply ONLY with JSON: {"score": number, "rationale": "one sentence in Spanish"}.',
          },
          {
            role: 'user',
            content: `Question (targets ${probe.targetBand}, skill: ${probe.skill}): ${probe.prompt}\nAnswer: ${answer}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    const score = Number(parsed.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) return null;
    return { score: Math.round(score), rationale: String(parsed.rationale ?? '') };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export { CEFR_BANDS };
