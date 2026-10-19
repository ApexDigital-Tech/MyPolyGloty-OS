/**
 * ScenarioEngine — Generador dinámico de roleplay.
 * MyPolyGloty OS - Sprint 4
 *
 * Construye el system prompt del Agente Tutor a partir de:
 *  1. Un escenario del catálogo o uno derivado de un documento del usuario.
 *  2. La banda CEFR diagnosticada (ajusta léxico, velocidad y longitud de turnos).
 *  3. Las fricciones detectadas (ajusta estrategia de corrección y presión).
 *  4. Fragmentos recuperados por BM25 en cada turno (RAG), si hay documento.
 */

import type { CefrBand, DiagnosticResult, FrictionType } from '../types/cefr';
import { Bm25Index, type IngestedDocument } from './documentIngestion';

export interface Scenario {
  id: string;
  title: string;
  category: 'negotiation' | 'emergency' | 'daily-life' | 'professional' | 'custom';
  tutorRole: string;
  learnerRole: string;
  setting: string;
  goal: string;
  openingLine: string;
  minBand: CefrBand;
  sourceDocId?: string;
}

export const SCENARIO_CATALOG: Scenario[] = [
  {
    id: 'neg-salary',
    title: 'Negociación salarial',
    category: 'negotiation',
    tutorRole: 'HR manager at a mid-size tech company, friendly but budget-conscious',
    learnerRole: 'Candidate who has just received a job offer',
    setting: 'Video call to discuss the offer details',
    goal: 'Obtain a better salary or benefits package with polite, well-argued requests',
    openingLine: "Thanks for joining. We're really excited to have you on board. Have you had a chance to review the offer?",
    minBand: 'B1',
  },
  {
    id: 'neg-supplier',
    title: 'Negociar con un proveedor',
    category: 'negotiation',
    tutorRole: 'Sales representative of a hardware supplier',
    learnerRole: 'Procurement lead who needs a lower unit price and faster delivery',
    setting: 'Meeting room, quarterly contract renewal',
    goal: 'Reach an agreement on price, volume and delivery terms',
    openingLine: "Good to see you again. I understand you'd like to revisit the terms for next quarter?",
    minBand: 'B2',
  },
  {
    id: 'emg-pharmacy',
    title: 'Urgencia en la farmacia',
    category: 'emergency',
    tutorRole: 'Pharmacist in London',
    learnerRole: 'Traveller with a high fever and a sore throat',
    setting: 'Late-night pharmacy',
    goal: 'Describe symptoms clearly and understand dosage instructions',
    openingLine: 'Hello, how can I help you tonight?',
    minBand: 'A2',
  },
  {
    id: 'emg-lost-passport',
    title: 'Pasaporte perdido',
    category: 'emergency',
    tutorRole: 'Police officer at an airport station',
    learnerRole: 'Tourist who lost their passport and has a flight in 6 hours',
    setting: 'Airport police desk',
    goal: 'File a report and find out the next steps quickly',
    openingLine: "Good afternoon. You look worried — what's happened?",
    minBand: 'A2',
  },
  {
    id: 'daily-restaurant',
    title: 'Pedir en un restaurante',
    category: 'daily-life',
    tutorRole: 'Waiter at a busy restaurant',
    learnerRole: 'Customer with a food allergy',
    setting: 'Dinner service, Friday night',
    goal: 'Order a meal, explain the allergy and ask about ingredients',
    openingLine: 'Good evening! Are you ready to order, or would you like a few more minutes?',
    minBand: 'A1',
  },
  {
    id: 'daily-flat',
    title: 'Visitar un piso de alquiler',
    category: 'daily-life',
    tutorRole: 'Landlord showing a flat',
    learnerRole: 'Prospective tenant',
    setting: 'Flat viewing',
    goal: 'Ask about rent, bills, contract length and neighbourhood',
    openingLine: "Hi, come in! So, this is the living room. What would you like to know?",
    minBand: 'A2',
  },
  {
    id: 'pro-interview',
    title: 'Entrevista técnica senior',
    category: 'professional',
    tutorRole: 'Alistair Vance, senior British engineering lead',
    learnerRole: 'Candidate for a senior backend engineer role',
    setting: 'Final-round technical interview',
    goal: 'Explain past projects, trade-offs and system design decisions convincingly',
    openingLine: 'Lovely to meet you. Could you walk me through a system you designed that you are particularly proud of?',
    minBand: 'B2',
  },
];

const BAND_GUIDANCE: Record<CefrBand, string> = {
  A1: 'Use very short sentences (max 8 words), only present simple and the most common 500 words. Speak slowly. Ask yes/no or either/or questions.',
  A2: 'Use short sentences, present and past simple, everyday vocabulary. One question per turn. Rephrase if the learner seems lost.',
  B1: 'Use clear standard English, common phrasal verbs, and open questions. Keep turns to 1-2 sentences.',
  B2: 'Use natural speed and register, some idioms, and follow-up questions that require justification or comparison.',
  C1: 'Use idiomatic, nuanced language, challenge the learner\'s arguments, and introduce unexpected complications.',
  C2: 'Behave like a demanding native professional: subtle register shifts, irony, rapid topic shifts, and high expectations of precision.',
};

const FRICTION_GUIDANCE: Record<FrictionType, string> = {
  'communicative-anxiety': 'The learner shows communicative anxiety: be warm, praise specific successes, and NEVER correct mid-turn; corrections go to the separate evaluator.',
  'grammatical-overthinking': 'The learner over-monitors grammar: keep the pace brisk and reward getting the message across over perfection.',
  'translation-latency': 'The learner translates mentally: model useful ready-made chunks in your replies (e.g., "What I mean is...", "The thing is...") so they can reuse them.',
  'phonetic-block': 'The learner has pronunciation blocks: when a key word appears, use it naturally twice so they hear the model pronunciation.',
};

export function scenarioFromDocument(doc: IngestedDocument, roleHint?: { tutorRole?: string; learnerRole?: string; goal?: string }): Scenario {
  const topTerms = doc.keyTerms.slice(0, 5).join(', ');
  return {
    id: `custom-${doc.id}`,
    title: doc.name.replace(/\.(pdf|txt|md)$/i, ''),
    category: 'custom',
    tutorRole: roleHint?.tutorRole?.trim() || `An expert counterpart deeply familiar with the material in "${doc.name}"`,
    learnerRole: roleHint?.learnerRole?.trim() || 'Professional who must discuss this material fluently',
    setting: `A realistic conversation grounded in the user's document (key topics: ${topTerms})`,
    goal: roleHint?.goal?.trim() || 'Discuss the document content accurately, using its specific vocabulary',
    openingLine: `I've gone through "${doc.name}". Shall we start with ${doc.keyTerms[0] ?? 'the main points'}? What's your take on it?`,
    minBand: 'B1',
    sourceDocId: doc.id,
  };
}

export class RoleplaySession {
  public readonly scenario: Scenario;
  private readonly diagnosis: DiagnosticResult | null;
  private readonly document: IngestedDocument | null;
  private index: Bm25Index | null;

  constructor(
    scenario: Scenario,
    diagnosis: DiagnosticResult | null,
    document: IngestedDocument | null
  ) {
    this.scenario = scenario;
    this.diagnosis = diagnosis;
    this.document = document;
    this.index = document ? new Bm25Index(document.chunks) : null;
  }

  get band(): CefrBand {
    return this.diagnosis?.band ?? 'B1';
  }

  get glossary(): string[] {
    return this.document?.keyTerms ?? [];
  }

  /** Recupera los fragmentos relevantes para el turno actual (mensaje + último turno del tutor). */
  retrieve(userUtterance: string, lastTutorText = ''): Array<{ text: string; score: number; chunkIndex: number }> {
    if (!this.index) return [];
    return this.index
      .search(`${userUtterance} ${lastTutorText}`, 3)
      .map((r) => ({ text: r.chunk.text, score: Math.round(r.score * 100) / 100, chunkIndex: r.chunk.index }));
  }

  buildSystemPrompt(retrieved: Array<{ text: string }> = []): string {
    const s = this.scenario;
    const strongFrictions = (this.diagnosis?.frictions ?? []).filter((f) => f.intensity >= 0.4);

    const parts = [
      `You are role-playing for an English speaking-practice app. Stay in character at all times.`,
      `ROLE: ${s.tutorRole}.`,
      `THE LEARNER PLAYS: ${s.learnerRole}.`,
      `SETTING: ${s.setting}.`,
      `LEARNER GOAL: ${s.goal}.`,
      `LEVEL ADAPTATION (learner is CEFR ${this.band}): ${BAND_GUIDANCE[this.band]}`,
      ...strongFrictions.map((f) => `ADAPTATION: ${FRICTION_GUIDANCE[f.type]}`),
      `RULES: Reply in 1-3 sentences, end most turns with a question, never break character to teach grammar.`,
    ];

    if (retrieved.length > 0) {
      parts.push(
        `GROUNDING — use ONLY these excerpts from the learner's document as factual source. ` +
          `If something is not covered, say you'd need to check rather than inventing details:\n` +
          retrieved.map((r, i) => `[${i + 1}] ${r.text}`).join('\n')
      );
    }
    if (this.glossary.length > 0) {
      parts.push(`Naturally weave in these key terms from the document: ${this.glossary.slice(0, 10).join(', ')}.`);
    }
    return parts.join('\n\n');
  }
}
