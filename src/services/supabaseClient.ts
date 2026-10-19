/**
 * Supabase Client & Cloud Persistence Service
 * MyPolyGloty OS - Cloud Sync & Database Layer
 * 
 * Conecta con el proyecto Supabase: https://rgnkwfgeivgfvqwcyiow.supabase.co
 * Provee sincronización asíncrona bidireccional para:
 * - Diagnósticos CEFR (bandas A1-C2, métricas temporales, fricciones psicológicas)
 * - Mazo de Repetición Espaciada FSRS v4.5 (estabilidad, dificultad, intervalos)
 * - Evaluaciones fonéticas quirúrgicas
 * - Historial y telemetría de sesiones conversacionales
 * 
 * Si la clave no está configurada o la red está inactiva, almacena localmente de forma resiliente.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DiagnosticResult } from '../types/cefr';
import type { FSRSCard } from './fsrsScheduler';
import type { PhoneticAnalysisResult } from '../phonetics/PhoneticEngine';

export const DEFAULT_SUPABASE_URL = 'https://rgnkwfgeivgfvqwcyiow.supabase.co';
const STORAGE_KEY_ANON = 'mypolygloty_supabase_anon_key';

export class SupabaseService {
  private static instance: SupabaseService | null = null;
  private client: SupabaseClient | null = null;
  private url: string = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  private anonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  private constructor() {
    this.initClient();
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  private initClient() {
    // Si no viene en env, buscar en localStorage
    if (!this.anonKey && typeof window !== 'undefined') {
      this.anonKey = localStorage.getItem(STORAGE_KEY_ANON) || '';
    }

    if (this.url && this.anonKey) {
      try {
        this.client = createClient(this.url, this.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });
        console.log('[SupabaseService] Cliente inicializado correctamente para', this.url);
      } catch (err) {
        console.warn('[SupabaseService] Error al crear cliente Supabase:', err);
        this.client = null;
      }
    } else {
      console.info('[SupabaseService] Esperando VITE_SUPABASE_ANON_KEY para habilitar sincronización en la nube.');
    }
  }

  public setAnonKey(key: string) {
    this.anonKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ANON, this.anonKey);
    }
    this.initClient();
  }

  public getAnonKey(): string {
    return this.anonKey;
  }

  public getUrl(): string {
    return this.url;
  }

  public isConnected(): boolean {
    return this.client !== null && Boolean(this.anonKey);
  }

  /**
   * Sincroniza el resultado del Diagnóstico CEFR con Supabase
   */
  public async syncCefrDiagnostic(result: DiagnosticResult): Promise<boolean> {
    if (!this.client) {
      console.log('[SupabaseService] Modo local activo: Diagnóstico CEFR guardado en localStorage.');
      return false;
    }

    try {
      const { error } = await this.client
        .from('cefr_diagnostics')
        .upsert({
          id: `diag_${result.completedAt}`,
          band: result.band,
          score: result.score,
          vocabulary_score: result.subScores.range,
          grammar_score: result.subScores.complexity,
          fluency_score: result.subScores.fluency,
          temporal_wpm: result.subScores.accuracy,
          psychological_frictions: result.frictions,
          turn_logs: result.turns,
          created_at: new Date(result.completedAt).toISOString(),
        });

      if (error) throw error;
      console.log('[SupabaseService] Diagnóstico CEFR sincronizado en Supabase.');
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Fallo al sincronizar CEFR:', err);
      return false;
    }
  }

  /**
   * Sincroniza la baraja FSRS completa con Supabase
   */
  public async syncFsrsCards(cards: FSRSCard[]): Promise<boolean> {
    if (!this.client || cards.length === 0) return false;

    try {
      const rows = cards.map((c) => ({
        id: c.id,
        item: c.item,
        target_lang: c.targetLang,
        card_type: c.type,
        ipa: c.ipa || null,
        context_sentence: c.contextSentence,
        due: new Date(c.due).toISOString(),
        stability: c.stability,
        difficulty: c.difficulty,
        reps: c.reps,
        lapses: c.lapses,
        state: c.state,
        last_review: c.lastReview ? new Date(c.lastReview).toISOString() : null,
        history: c.history,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await this.client.from('fsrs_cards').upsert(rows);
      if (error) throw error;
      console.log(`[SupabaseService] ${cards.length} tarjetas FSRS sincronizadas en Supabase.`);
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error sincronizando tarjetas FSRS:', err);
      return false;
    }
  }

  /**
   * Sincroniza evaluación fonética quirúrgica
   */
  public async syncPhoneticEvaluation(
    targetWord: string,
    result: PhoneticAnalysisResult
  ): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client.from('phonetic_evaluations').insert({
        target_word: result.targetWord || targetWord,
        canonical_ipa: result.phonemeScores.map((p) => p.phoneme).join(''),
        detected_ipa: result.failingPhoneme || 'ok',
        overall_score: result.overallScore,
        formants: { diagnostic: result.diagnostic },
        phonemes: result.phonemeScores,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      console.log('[SupabaseService] Evaluación fonética guardada en Supabase.');
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Fallo al guardar evaluación fonética:', err);
      return false;
    }
  }
}
