/**
 * Supabase Client & Cloud Persistence Service
 * MyPolyGloty OS - Cloud Sync & Database Layer (v2 Seguro)
 * 
 * Conecta con el proyecto Supabase: https://rgnkwfgeivgfvqwcyiow.supabase.co
 * RLS: Solo rol "authenticated". Cero llamadas para usuarios sin sesión (Local-First).
 * 
 * Si no hay sesión activa o falta la clave anon, opera de forma 100% local en localStorage
 * garantizando 0 llamadas a supabase.co/rest/v1 sin autenticación.
 */

import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import type { DiagnosticResult } from '../types/cefr';
import type { FSRSCard } from './fsrsScheduler';
import type { PhoneticAnalysisResult } from '../phonetics/PhoneticEngine';

export const DEFAULT_SUPABASE_URL = 'https://rgnkwfgeivgfvqwcyiow.supabase.co';
const STORAGE_KEY_ANON = 'mypolygloty_supabase_anon_key';

export class SupabaseService {
  private static instance: SupabaseService | null = null;
  public client: SupabaseClient | null = null;
  private url: string = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  private anonKey: string = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  private cachedSession: Session | null = null;

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
            detectSessionInUrl: true,
          },
        });

        // Suscribirse a cambios de sesión para cachear estado localmente
        this.client.auth.onAuthStateChange((_event, session) => {
          this.cachedSession = session;
        });

        // Obtener sesión inicial si existe
        this.client.auth.getSession().then(({ data }) => {
          this.cachedSession = data.session;
        }).catch(() => {
          this.cachedSession = null;
        });

        console.log('[SupabaseService] Cliente inicializado correctamente para', this.url);
      } catch (err) {
        console.warn('[SupabaseService] Error al crear cliente Supabase:', err);
        this.client = null;
      }
    } else {
      console.info('[SupabaseService] Modo Local-First activo: esperando VITE_SUPABASE_ANON_KEY.');
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
   * Verifica si existe una sesión activa autenticada en Supabase.
   * REGLA RLS CRÍTICA: Si no hay sesión activa, NO debe realizarse ninguna petición REST a Supabase.
   */
  public async getActiveUserId(): Promise<string | null> {
    if (!this.client || !this.isConnected()) return null;

    if (this.cachedSession?.user?.id) {
      return this.cachedSession.user.id;
    }

    try {
      const { data } = await this.client.auth.getSession();
      this.cachedSession = data.session;
      return data.session?.user?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Sincroniza el resultado del Diagnóstico CEFR con Supabase solo si hay sesión activa
   */
  public async syncCefrDiagnostic(result: DiagnosticResult): Promise<boolean> {
    const userId = await this.getActiveUserId();
    if (!this.client || !userId) {
      // Cero llamadas HTTP a Supabase sin sesión activa (Local-First)
      console.log('[SupabaseService] Local-First: Diagnóstico CEFR conservado en localStorage (sin sesión activa).');
      return false;
    }

    try {
      const globalId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? `diag_${crypto.randomUUID()}`
        : `diag_${result.completedAt}_${Math.random().toString(36).substring(2, 8)}`;

      const { error } = await this.client
        .from('cefr_diagnostics')
        .upsert({
          id: globalId,
          user_id: userId,
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
   * Sincroniza la baraja FSRS completa con Supabase solo si hay sesión activa
   */
  public async syncFsrsCards(cards: FSRSCard[]): Promise<boolean> {
    const userId = await this.getActiveUserId();
    if (!this.client || !userId || cards.length === 0) {
      // Cero llamadas HTTP a Supabase sin sesión activa
      return false;
    }

    try {
      const rows = cards.map((c) => ({
        id: c.id,
        user_id: userId,
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
   * Sincroniza evaluación fonética quirúrgica solo si hay sesión activa
   */
  public async syncPhoneticEvaluation(
    targetWord: string,
    result: PhoneticAnalysisResult
  ): Promise<boolean> {
    const userId = await this.getActiveUserId();
    if (!this.client || !userId) {
      // Cero llamadas HTTP a Supabase sin sesión activa
      return false;
    }

    try {
      const { error } = await this.client.from('phonetic_evaluations').insert({
        user_id: userId,
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
