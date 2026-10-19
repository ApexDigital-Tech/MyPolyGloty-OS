/**
 * Extractor de rasgos lingüísticos medibles para el diagnóstico CEFR.
 * MyPolyGloty OS - Sprint 4
 *
 * Todas las funciones son puras y deterministas para poder calibrarlas con
 * `scripts/run_cefr_calibration.ts` contra textos de referencia por banda.
 *
 * Limitaciones conocidas (documentadas a propósito):
 * - El núcleo léxico es una aproximación (~300 palabras de máxima frecuencia),
 *   no una lista oficial English Vocabulary Profile.
 * - La detección de errores gramaticales es por patrones; detecta errores típicos
 *   de hispanohablantes, no todos los errores posibles. El evaluador LLM opcional
 *   cubre ese hueco cuando hay clave BYOK.
 */

import type { TurnFeatures, TurnTiming } from '../types/cefr';

// Núcleo léxico de alta frecuencia (aprox. niveles A1–A2).
const CORE_WORDS = new Set(
  `a about above after again all also always am an and any are around as ask at away back bad be because been before
  being best better big book both boy but buy by call came can car child children city come could day did different do
  does dog don't done down during each early eat end enough even every family far father feel few find first food for
  friend from fun gave get girl give go goes going good got great had happy has have he her here him his home house how
  i if in into is it its just keep kind know last late learn leave left let life like little live long look lot love made
  make man many may me mean money more morning most mother much music must my name need never new next nice night no not
  now of off often old on once one only or other our out over own people place play please put read really right room
  said same saw say school see she should show since small so some something sometimes soon start still stop study such
  sure take talk teacher tell than thank thanks that the their them then there these they thing things think this those
  time to today together told too took town try two under until up us use used very visit want was watch water way we
  week well went were what when where which while who why will with woman work world would write year yes yesterday you
  young your get got getting went gone came coming makes made likes liked wanted works worked lives lived plays played
  i'm it's that's there's you're we're they're can't didn't doesn't isn't wasn't won't i've i'll okay ok yeah hello hi
  job jobs office company day days time times years weekend usually every new old fast slow easy hard`
    .split(/\s+/)
    .filter(Boolean)
);

const SUBORDINATORS = [
  'because', 'although', 'though', 'unless', 'whereas', 'whether', 'which', 'whom', 'whose',
  'while', 'since', 'so that', 'in order to', 'provided that', 'as long as', 'even if', 'even though',
  'once', 'until', 'whenever', 'wherever', 'if', 'when', 'who', 'that',
];

const ADVANCED_CONNECTORS = [
  'however', 'nevertheless', 'nonetheless', 'furthermore', 'moreover', 'consequently',
  'therefore', 'whereas', 'on the other hand', 'in contrast', 'as a result', 'that said',
  'admittedly', 'by contrast', 'in hindsight', 'to some extent', 'arguably', 'notwithstanding',
];

const FILLED_PAUSES = /\b(uh+|um+|erm+|er|hmm+|eh+|ehm+|este|o sea|like,|you know)\b/gi;
/** Reinicios: "I go— I went", "I have... I had", palabra repetida inmediata, "sorry, I mean". */
const SELF_CORRECTION = /(\b(\w+)\b[\s,.-]+\2\b)|(—|--)|\b(i mean|sorry|no wait|let me rephrase)\b/gi;

const VERB_FORM_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'past-simple', re: /\b(\w+ed|went|was|were|did|had|made|took|saw|got|came|said|told|thought|built|led)\b/i },
  { id: 'present-perfect', re: /\b(have|has)\s+(been|\w+ed|done|gone|seen|made|taken|built|led)\b/i },
  { id: 'past-perfect', re: /\bhad\s+(been|\w+ed|done|gone|seen|made|taken)\b/i },
  { id: 'continuous', re: /\b(am|is|are|was|were|been)\s+\w+ing\b/i },
  { id: 'future', re: /\b(will|'ll|going to)\s+\w+/i },
  { id: 'conditional', re: /\b(would|could|might)\s+(have\s+)?\w+/i },
  { id: 'passive', re: /\b(is|are|was|were|been|being|be)\s+\w+ed\b/i },
  { id: 'modal-perfect', re: /\b(should|would|could|might|must)\s+have\s+\w+/i },
];

/** Errores frecuentes de hispanohablantes, detectables con alta precisión. */
export const ERROR_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(he|she|it)\s+(have|do|go|want|like|don't)\b/i, label: 'Concordancia 3ª persona (he have / she don\'t)' },
  { re: /\b(i|you|we|they)\s+(has|does|goes|wants|likes|doesn't)\b/i, label: 'Concordancia (I has / they goes)' },
  { re: /\b(go|eat|see|have|do|buy|work)\s+yesterday\b/i, label: 'Presente con marcador de pasado (go yesterday)' },
  { re: /\bi\s+have\s+\w+\s+(yesterday|last\s+\w+|ago)\b/i, label: 'Present Perfect con tiempo pasado definido' },
  { re: /\bmore\s+(better|easier|bigger|faster|worse)\b/i, label: 'Doble comparativo (more better)' },
  { re: /\bpeople\s+is\b/i, label: 'Concordancia (people is)' },
  { re: /\bdepend\s+of\b/i, label: 'Preposición (depend of → depend on)' },
  { re: /\b(i am|i'm)\s+agree\b/i, label: 'Calco (I am agree)' },
  { re: /\bexplain\s+me\b/i, label: 'Calco (explain me)' },
  { re: /\bhave\s+\d+\s+years\b/i, label: 'Calco de edad (have 30 years)' },
  { re: /\b(is|are)\s+\w+\s+since\s+\d/i, label: 'Presente con since (is here since)' },
  { re: /\bthe\s+(life|people|nature)\s+is\b/i, label: 'Artículo genérico innecesario (the life is)' },
];

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => tokenize(s).length > 0);
}

/** MATTR: media del TTR en ventanas deslizantes. Para textos < ventana, TTR simple. */
export function movingAverageTtr(tokens: string[], window = 25): number {
  if (tokens.length === 0) return 0;
  if (tokens.length <= window) return new Set(tokens).size / tokens.length;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + window <= tokens.length; i++) {
    sum += new Set(tokens.slice(i, i + window)).size / window;
    n++;
  }
  return sum / n;
}

function countPhrases(lower: string, phrases: string[]): number {
  let count = 0;
  for (const p of phrases) {
    const re = new RegExp(`\\b${p.replace(/\s+/g, '\\s+')}\\b`, 'g');
    count += lower.match(re)?.length ?? 0;
  }
  return count;
}

export function detectGrammarErrors(text: string): string[] {
  return ERROR_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}

export function extractFeatures(text: string, timing?: Partial<TurnTiming>): TurnFeatures {
  const tokens = tokenize(text);
  const sentences = splitSentences(text);
  const lower = ` ${text.toLowerCase()} `;
  const wordCount = tokens.length;
  const sentenceCount = Math.max(1, sentences.length);

  // Sofisticación: palabras de ≥6 letras fuera del núcleo de alta frecuencia, sobre el total.
  const sophisticated = tokens.filter((t) => t.length >= 6 && !CORE_WORDS.has(t)).length;

  // "that" y "if/when/who" son ambiguos; se ponderan a la mitad.
  const strongSubs = countPhrases(lower, SUBORDINATORS.filter((s) => !['that', 'if', 'when', 'who'].includes(s)));
  const weakSubs = countPhrases(lower, ['that', 'if', 'when', 'who']);

  const verbFormVariety = VERB_FORM_PATTERNS.filter((p) => p.re.test(text)).length;
  const filledPauses = text.match(FILLED_PAUSES)?.length ?? 0;
  const selfCorrections = text.match(SELF_CORRECTION)?.length ?? 0;

  const speechMs = timing?.speechDurationMs ?? null;
  const wordsPerMinute = speechMs && speechMs > 1000 ? (wordCount / speechMs) * 60000 : null;

  return {
    wordCount,
    sentenceCount: sentences.length,
    meanSentenceLength: wordCount / sentenceCount,
    mattr: movingAverageTtr(tokens),
    lexicalSophistication: wordCount ? sophisticated / wordCount : 0,
    meanWordLength: wordCount ? tokens.reduce((a, t) => a + t.length, 0) / wordCount : 0,
    subordinationPerSentence: (strongSubs + weakSubs * 0.5) / sentenceCount,
    advancedConnectors: countPhrases(lower, ADVANCED_CONNECTORS),
    verbFormVariety,
    filledPauses,
    selfCorrections,
    wordsPerMinute,
  };
}

/** Normaliza x al rango [0,1] entre lo (0) y hi (1). */
export const norm = (x: number, lo: number, hi: number): number =>
  Math.max(0, Math.min(1, (x - lo) / (hi - lo)));

export interface HeuristicSubScores {
  range: number;
  accuracy: number;
  complexity: number;
  fluency: number;
  total: number;
  grammarErrors: string[];
}

/**
 * Puntuación heurística 0-100.
 * - Solo texto: extensión 20%, rango léxico 40%, complejidad 40%.
 * - Con audio: se añade fluidez al 20% y se reescalan los demás.
 * - La corrección actúa como penalización multiplicativa: no detectar errores
 *   no prueba precisión, pero detectarlos sí es evidencia en contra.
 * - Topes por longitud: respuestas muy cortas no pueden demostrar nivel alto.
 */
export function scoreHeuristic(text: string, f: TurnFeatures, timing?: Partial<TurnTiming>): HeuristicSubScores {
  // MATTR se infla en textos cortos (casi todo es único): se encoge hacia 0.5 según la longitud.
  const mattrReliability = norm(f.wordCount, 10, 40);
  const mattrAdj = 0.5 + (f.mattr - 0.5) * mattrReliability;

  const range =
    0.5 * norm(f.lexicalSophistication, 0.03, 0.35) +
    0.3 * norm(f.meanWordLength, 3.6, 5.6) +
    0.2 * norm(mattrAdj, 0.55, 0.85);

  const complexity =
    0.35 * norm(f.meanSentenceLength, 6, 26) +
    0.3 * norm(f.subordinationPerSentence, 0, 1.2) +
    0.15 * norm(f.advancedConnectors, 0, 2) +
    0.2 * norm(f.verbFormVariety, 1, 5);

  const extent = norm(f.wordCount, 6, 55);

  const grammarErrors = detectGrammarErrors(text);
  const errorDensity = f.wordCount ? (grammarErrors.length * 10) / f.wordCount : 0;
  // 1 error en 10 palabras → -40 %; tope de penalización 60 %.
  const accuracy = Math.max(0.4, 1 - 0.4 * errorDensity - 0.04 * f.selfCorrections);

  const hasAudio = f.wordsPerMinute !== null || timing?.responseOnsetMs != null;
  const disfluencyRate = f.wordCount ? (f.filledPauses + f.selfCorrections) / f.wordCount : 0;
  let fluency = 1 - norm(disfluencyRate, 0, 0.15);
  if (f.wordsPerMinute !== null) fluency = 0.6 * norm(f.wordsPerMinute, 50, 150) + 0.4 * fluency;
  if (timing?.responseOnsetMs != null) fluency -= 0.25 * norm(timing.responseOnsetMs, 1500, 5000);
  if (timing?.longPauseCount != null) fluency -= 0.05 * Math.min(4, timing.longPauseCount);
  fluency = Math.max(0, Math.min(1, fluency));

  const base = hasAudio
    ? 0.16 * extent + 0.32 * range + 0.32 * complexity + 0.2 * fluency
    : 0.2 * extent + 0.4 * range + 0.4 * complexity;

  let total = 100 * base * accuracy;

  // Tope por longitud: con < 8 palabras no hay evidencia de B1+; con < 20, no de B2+.
  if (f.wordCount < 8) total = Math.min(total, 30);
  else if (f.wordCount < 20) total = Math.min(total, 50);

  return {
    range: Math.round(range * 100),
    accuracy: Math.round(accuracy * 100),
    complexity: Math.round(complexity * 100),
    fluency: Math.round(fluency * 100),
    total: Math.round(total),
    grammarErrors,
  };
}
