/**
 * Definiciones y Tipos para el Sistema BYOK (Bring Your Own Key) y Orquestación Dual
 * MyPolyGloty OS - Sprint 2
 */

export type AiProvider = 'groq' | 'openai' | 'gemini' | 'anthropic' | 'local-mock';

export interface ProviderConfig {
  id: AiProvider;
  name: string;
  defaultModel: string;
  availableModels: string[];
  requiresKey: boolean;
  apiKey?: string;
  isConfigured: boolean;
  endpoint?: string;
}

export interface GrammaticalError {
  type: 'tense' | 'agreement' | 'preposition' | 'word-order' | 'article' | 'vocabulary';
  original: string;
  corrected: string;
  explanation: string;
}

export interface VocabularySuggestion {
  original: string;
  betterAlternative: string;
  cefrLevel: string;
  reason: string;
}

export interface PedagogicalEvaluation {
  id: string;
  timestamp: number;
  userText: string;
  cefrBand: string;
  grammarScore: number;       // 0 - 100
  vocabularyScore: number;    // 0 - 100
  fluencyScore: number;       // 0 - 100
  errors: GrammaticalError[];
  vocabularySuggestions: VocabularySuggestion[];
  positiveFeedback: string;
  nextStepRecommendation: string;
}

export interface SentenceChunk {
  index: number;
  text: string;
  isFirst: boolean;
  isLast: boolean;
  timestampMs: number;
}
