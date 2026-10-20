/**
 * FSRS - Free Spaced Repetition Scheduler v4.5
 * MyPolyGloty OS - Sprint 6
 * 
 * Implementación de algoritmos matemáticos basados en el modelo DSR (Dificultad, Estabilidad, Retentividad)
 * de SuperMemo / Open-Spaced-Repetition (FSRS-4.5).
 * 
 * Mapea fallos articulatorios (fonemas IPA, pares mínimos) y errores sintácticos detectados
 * por el LLM Evaluador hacia cartas de memoria espaciadas con cálculo exacto de intervalo de repaso.
 */

export type FSRSRating = 1 | 2 | 3 | 4; // 1: Again (Fallo grave), 2: Hard (Dudoso), 3: Good (Correcto), 4: Easy (Fluido)
export type FSRSState = 'new' | 'learning' | 'review' | 'relearning';
export type CardType = 'phonetic' | 'tone' | 'grammar' | 'lexical';

export interface FSRSCard {
  id: string;
  item: string;               // e.g. "very (/v/ vs /b/)" o "mā (1er tono)" o "Present Perfect"
  targetLang: string;         // 'en' | 'zh' | 'es'
  type: CardType;
  ipa?: string;
  contextSentence: string;
  due: number;                // Timestamp ms cuando debe repasarse
  stability: number;          // Días hasta que R = 90%
  difficulty: number;         // 1.0 (muy fácil) a 10.0 (muy difícil)
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;             // Veces que se ha calificado 'Again'
  state: FSRSState;
  lastReview?: number;
  history: ReviewLog[];
}

export interface ReviewLog {
  rating: FSRSRating;
  elapsedDays: number;
  scheduledDays: number;
  reviewTimestamp: number;
  state: FSRSState;
}

export interface FSRSParameters {
  requestRetention: number;   // Objetivo de retención (default: 0.90)
  maximumInterval: number;    // Máximo intervalo en días (default: 36500)
  w: number[];                // 17 pesos del modelo FSRS v4.5
}

export const DEFAULT_FSRS_PARAMS: FSRSParameters = {
  requestRetention: 0.90,
  maximumInterval: 365,
  w: [
    0.4072, 1.1829, 3.1262, 15.4722, // Iniciales para Again, Hard, Good, Easy
    7.2102, 0.5316, 1.0651, 0.0234,  // Actualización de dificultad
    1.616,  0.1544, 1.0824,          // Estabilidad en recall exitoso
    1.9813, 0.0953, 0.2975, 2.2042,  // Estabilidad en lapse (Again)
    0.2407, 2.9466                   // Ajustes de retención
  ],
};

const STORAGE_KEY = 'mypolygloty_fsrs_deck_v1';

export class FSRSScheduler {
  private static instance: FSRSScheduler | null = null;
  private params: FSRSParameters;
  private cards: Map<string, FSRSCard> = new Map();

  private constructor(params: FSRSParameters = DEFAULT_FSRS_PARAMS) {
    this.params = params;
    this.loadDeck();
  }

  public static getInstance(): FSRSScheduler {
    if (!FSRSScheduler.instance) {
      FSRSScheduler.instance = new FSRSScheduler();
    }
    return FSRSScheduler.instance;
  }

  /**
   * Crea una nueva tarjeta a partir de un error detectado durante la conversación o comparador fonético.
   */
  public addCard(options: {
    item: string;
    targetLang: string;
    type: CardType;
    ipa?: string;
    contextSentence: string;
  }): FSRSCard {
    const existing = Array.from(this.cards.values()).find(
      (c) => c.item.toLowerCase() === options.item.toLowerCase()
    );
    if (existing) {
      return existing;
    }

    const newCard: FSRSCard = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      item: options.item,
      targetLang: options.targetLang,
      type: options.type,
      ipa: options.ipa,
      contextSentence: options.contextSentence,
      due: Date.now(), // Disponible de inmediato
      stability: 0,
      difficulty: 5.0, // Dificultad neutra media
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
      history: [],
    };

    this.cards.set(newCard.id, newCard);
    this.saveDeck();
    return newCard;
  }

  /**
   * Califica y recalcula la estabilidad, dificultad y fecha de próximo repaso según FSRS v4.5.
   */
  public reviewCard(cardId: string, rating: FSRSRating): FSRSCard {
    const card = this.cards.get(cardId);
    if (!card) throw new Error(`Card ${cardId} not found`);

    const now = Date.now();
    const elapsedDays = card.lastReview
      ? Math.max(0, (now - card.lastReview) / (1000 * 60 * 60 * 24))
      : 0;

    let newStability = card.stability;
    let newDifficulty = card.difficulty;
    let newState: FSRSState = card.state;
    let newLapses = card.lapses;

    const w = this.params.w;

    if (card.state === 'new') {
      // Inicialización basada en w[0..3]
      newStability = Math.max(0.1, w[rating - 1]);
      newDifficulty = Math.min(10, Math.max(1, w[4] - Math.exp(w[5] * (rating - 1)) + 1));
      newState = rating === 1 ? 'learning' : 'review';
      if (rating === 1) newLapses++;
    } else {
      // Actualización de Dificultad
      const deltaD = -w[6] * (rating - 3);
      newDifficulty = Math.min(10, Math.max(1, card.difficulty + deltaD));

      if (rating === 1) {
        // Lapse (Olvido)
        newLapses++;
        newState = 'relearning';
        newStability = Math.max(0.1, w[11] * Math.pow(card.difficulty, -w[12]) * (Math.pow(card.stability + 1, w[13]) - 1) * Math.exp(w[14] * (1 - 0.9)));
      } else {
        // Recall exitoso (Hard, Good, Easy)
        newState = 'review';
        const hardPenalty = rating === 2 ? w[15] : 1.0;
        const easyBonus = rating === 4 ? w[16] : 1.0;
        const retrievability = Math.pow(1 + elapsedDays / (9 * card.stability), -1);
        newStability = card.stability * (1 + Math.exp(w[8]) * (11 - newDifficulty) * Math.pow(card.stability, -w[9]) * (Math.exp((1 - retrievability) * w[10]) - 1) * hardPenalty * easyBonus);
      }
    }

    // Calcular días programados para alcanzar retención objetivo (90%)
    const factor = Math.pow(this.params.requestRetention, -1) - 1;
    let scheduledDays = Math.max(1, Math.round(9 * newStability * factor));
    if (scheduledDays > this.params.maximumInterval) {
      scheduledDays = this.params.maximumInterval;
    }

    const updatedCard: FSRSCard = {
      ...card,
      stability: Math.round(newStability * 100) / 100,
      difficulty: Math.round(newDifficulty * 100) / 100,
      state: newState,
      lapses: newLapses,
      reps: card.reps + 1,
      elapsedDays,
      scheduledDays,
      lastReview: now,
      due: now + scheduledDays * 24 * 60 * 60 * 1000,
      history: [
        ...card.history,
        {
          rating,
          elapsedDays,
          scheduledDays,
          reviewTimestamp: now,
          state: card.state,
        },
      ],
    };

    this.cards.set(cardId, updatedCard);
    this.saveDeck();
    return updatedCard;
  }

  /**
   * Obtiene las cartas pendientes para hoy (due <= now).
   */
  public getDueCards(): FSRSCard[] {
    const now = Date.now();
    return Array.from(this.cards.values())
      .filter((card) => card.due <= now)
      .sort((a, b) => a.due - b.due);
  }

  /**
   * Devuelve todas las tarjetas de la baraja activa.
   */
  public getAllCards(): FSRSCard[] {
    return Array.from(this.cards.values());
  }

  /**
   * Extrae los ítems de mayor dificultad y retraso para inyectar al tutor LLM
   * de modo que reaparezcan de forma natural en el guion de conversación.
   */
  public getOrganicPromptInjectors(limit: number = 3): string[] {
    const due = this.getDueCards();
    const candidates = due.length > 0 ? due : Array.from(this.cards.values());
    return candidates
      .sort((a, b) => b.difficulty - a.difficulty)
      .slice(0, limit)
      .map((c) => `${c.item} (Práctica recomendada: "${c.contextSentence}")`);
  }

  /**
   * Carga el mazo desde localStorage o inicializa con ejemplos del Spike Fonético.
   */
  private loadDeck() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FSRSCard[];
        this.cards.clear();
        parsed.forEach((c) => this.cards.set(c.id, c));
        return;
      }
    } catch (e) {
      console.warn('[FSRS] Error al cargar mazo de localStorage:', e);
    }

    // Inicializar con errores fonéticos detectados en los benchmarks
    this.seedDefaultCards();
  }

  private saveDeck() {
    try {
      const list = Array.from(this.cards.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[FSRS] Error al guardar mazo en localStorage:', e);
    }
  }

  private seedDefaultCards() {
    const seed: Array<Omit<FSRSCard, 'id' | 'due' | 'stability' | 'difficulty' | 'elapsedDays' | 'scheduledDays' | 'reps' | 'lapses' | 'state' | 'history'>> = [
      {
        item: "very (/v/ vs /b/)",
        targetLang: "en",
        type: "phonetic",
        ipa: "/ˈvɛri/ -> */ˈbɛri/",
        contextSentence: "I am very excited about the distributed architecture.",
      },
      {
        item: "think (/θ/ vs /s/)",
        targetLang: "en",
        type: "phonetic",
        ipa: "/θɪŋk/ -> */sɪŋk/",
        contextSentence: "I think we should optimize the audio worklet queue.",
      },
      {
        item: "mā / má (Tono 1 vs Tono 2)",
        targetLang: "zh",
        type: "tone",
        ipa: "mā (5-5) -> má (3-5)",
        contextSentence: "妈妈在家里准备了茶 (Māma zài jiālǐ zhǔnbèile chá).",
      },
      {
        item: "Present Perfect vs Past Simple",
        targetLang: "en",
        type: "grammar",
        contextSentence: "I have lived here for five years (not: 'I live here since five years').",
      },
      {
        item: "ship vs sheep (/ɪ/ vs /iː/)",
        targetLang: "en",
        type: "phonetic",
        ipa: "/ʃɪp/ vs /ʃiːp/",
        contextSentence: "Look at that large cargo ship sailing into the bay.",
      },
    ];

    seed.forEach((s) => this.addCard(s));
  }
}
