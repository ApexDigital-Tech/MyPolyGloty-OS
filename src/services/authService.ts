/**
 * AuthService - Gestión de Autenticación, Usuarios y Sincronización Segura
 * MyPolyGloty OS - Capa de Usuario y Cloud Sync
 * 
 * Reglas de Arquitectura Segura v2 (20 de octubre de 2026):
 * 1. RLS Restringido: Solo rol 'authenticated'. El rol 'anon' no tiene permisos de lectura ni escritura.
 * 2. Cero llamadas HTTP a Supabase sin sesión activa (Local-First).
 * 3. Inserción delegada al trigger `on_auth_user_created` en Supabase: signUp envía options.data
 *    y NUNCA ejecuta inserts manuales a 'profiles' ni a 'user_progress'.
 * 4. Categorías de memoria del tutor estrictamente limitadas a:
 *    'fact', 'interest', 'weakness', 'goal', 'preference'.
 * 
 * REGLA DE SINCRONIZACIÓN DOCUMENTADA (Local -> Nube):
 * - Perfil ('profiles'): La nube es la fuente de verdad (Cloud-Master). Se descargan los datos
 *   remotos de la base de datos y se actualiza el caché de localStorage.
 * - Progreso ('user_progress'): Unión con selección del valor máximo (Max-Accumulative).
 *   streak_days = max(local, remote), total_xp = max(local, remote), total_turns = max(local, remote),
 *   total_lessons = max(local, remote). Si el avance offline supera al remoto, se actualiza la nube.
 * - Memoria ('user_memory'): Unión aditiva deduplicada por 'key_phrase'. Las memorias locales
 *   nuevas se insertan en Supabase validando las 5 categorías, y las remotas se guardan en el caché local.
 */

import { SupabaseService } from './supabaseClient';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  targetLang: 'en' | 'zh';
  currentLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  createdAt: string;
}

export interface UserProgress {
  userId: string;
  streakDays: number;
  totalXp: number;
  totalTurns: number;
  totalLessons: number;
  fluencyScore: number;
  vocabScore: number;
  grammarScore: number;
  lastActiveAt: string;
}

export type ValidMemoryCategory = 'fact' | 'interest' | 'weakness' | 'goal' | 'preference';

export interface UserMemoryItem {
  id?: number | string;
  userId: string;
  category: ValidMemoryCategory;
  keyPhrase: string;
  memoryValue: string;
  confidence: number;
  createdAt?: string;
}

const STORAGE_KEY_USER = 'mypolygloty_active_user';
const STORAGE_KEY_PROGRESS = 'mypolygloty_user_progress';
const STORAGE_KEY_LOCAL_USERS = 'mypolygloty_local_registered_users';
const STORAGE_KEY_MEMORIES = 'mypolygloty_user_memories';

/**
 * Normaliza cualquier categoría de memoria a una de las 5 permitidas por el CHECK en PostgreSQL:
 * 'fact', 'interest', 'weakness', 'goal', 'preference'
 */
export function normalizeMemoryCategory(rawCat: string): ValidMemoryCategory {
  const norm = (rawCat || '').toLowerCase().trim();
  switch (norm) {
    case 'fact':
    case 'personal':
    case 'data':
      return 'fact';
    case 'interest':
    case 'interests':
    case 'hobby':
    case 'hobbies':
      return 'interest';
    case 'weakness':
    case 'correction':
    case 'corrections':
    case 'error':
    case 'weaknesses':
      return 'weakness';
    case 'goal':
    case 'goals':
    case 'target':
    case 'objective':
      return 'goal';
    case 'preference':
    case 'preferences':
    case 'taste':
    case 'tastes':
    case 'like':
    case 'likes':
      return 'preference';
    default:
      return 'fact';
  }
}

export class AuthService {
  private static instance: AuthService | null = null;
  private currentUser: UserProfile | null = null;
  private currentProgress: UserProgress | null = null;
  private authSubscribers: Array<(user: UserProfile | null) => void> = [];

  private constructor() {
    this.restoreSession();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Restaura la sesión del usuario guardada localmente y enlaza los eventos de Supabase Auth
   */
  private restoreSession(): void {
    if (typeof window === 'undefined') return;

    try {
      const storedUser = localStorage.getItem(STORAGE_KEY_USER);
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }

      const storedProgress = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (storedProgress) {
        this.currentProgress = JSON.parse(storedProgress);
      }
    } catch (err) {
      console.warn('[AuthService] Error al restaurar sesión previa de localStorage:', err);
    }

    const supabase = SupabaseService.getInstance();
    const client = supabase.client;
    if (client && client.auth) {
      client.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
          await this.loadUserProfileFromSupabase(session.user.id, session.user.email);
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          this.currentProgress = null;
          localStorage.removeItem(STORAGE_KEY_USER);
          localStorage.removeItem(STORAGE_KEY_PROGRESS);
          this.notifySubscribers();
        }
      });
    }
  }

  /**
   * Registro de nuevo usuario (Sign Up)
   * REGLAS:
   * 1. Envía options.data = { full_name, target_lang, current_level }.
   * 2. CERO inserts manuales a profiles o user_progress (el trigger on_auth_user_created los genera).
   * 3. Maneja los dos casos: con sesión inmediata y sin sesión (confirmación por correo requerida).
   */
  public async signUp(
    email: string,
    password: string,
    fullName: string,
    targetLang: 'en' | 'zh' = 'en',
    currentLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' = 'A1'
  ): Promise<{ success: boolean; needsEmailConfirmation?: boolean; message?: string; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim() || 'Estudiante';
    const supabase = SupabaseService.getInstance();
    const client = supabase.client;

    // 1. Intentar con Supabase Auth si está conectado
    if (client && supabase.isConnected()) {
      try {
        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              full_name: cleanName,
              target_lang: targetLang,
              current_level: currentLevel,
            },
          },
        });

        if (error) {
          return { success: false, error: error.message };
        }

        // Caso B: Sin sesión inmediata (confirmación de email requerida en Supabase)
        if (data.user && !data.session) {
          console.info('[AuthService] Usuario creado. Confirmación de correo pendiente.');
          // CERO escrituras a la base de datos hasta que haya sesión confirmada
          return {
            success: true,
            needsEmailConfirmation: true,
            message: 'Cuenta registrada. Revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión.',
          };
        }

        // Caso A: Con sesión inmediata (confirmación desactivada o automática)
        if (data.session && data.user) {
          // Breve respiro para que el trigger on_auth_user_created termine de asentar las filas
          await new Promise((resolve) => setTimeout(resolve, 300));
          await this.loadUserProfileFromSupabase(data.user.id, cleanEmail);
          return { success: true, needsEmailConfirmation: false };
        }

        return { success: true };
      } catch (err: any) {
        console.warn('[AuthService] Fallo de red en Supabase SignUp, activando modo Local-First:', err);
      }
    }

    // 2. Modo Local-First Resiliente (para testing offline o sin anon key)
    try {
      const usersRaw = localStorage.getItem(STORAGE_KEY_LOCAL_USERS) || '[]';
      const localUsers: Array<{ email: string; passwordHash: string; profile: UserProfile; progress: UserProgress }> = JSON.parse(usersRaw);

      if (localUsers.some((u) => u.email === cleanEmail)) {
        return { success: false, error: 'Este correo ya se encuentra registrado. Inicia sesión.' };
      }

      const userId = `local_user_${Date.now()}`;
      const newProfile: UserProfile = {
        id: userId,
        email: cleanEmail,
        fullName: cleanName,
        targetLang: targetLang,
        currentLevel: currentLevel,
        createdAt: new Date().toISOString(),
      };

      const initialProgress: UserProgress = {
        userId: userId,
        streakDays: 1,
        totalXp: 50,
        totalTurns: 0,
        totalLessons: 0,
        fluencyScore: 82,
        vocabScore: 80,
        grammarScore: 84,
        lastActiveAt: new Date().toISOString(),
      };

      localUsers.push({
        email: cleanEmail,
        passwordHash: btoa(password),
        profile: newProfile,
        progress: initialProgress,
      });

      localStorage.setItem(STORAGE_KEY_LOCAL_USERS, JSON.stringify(localUsers));
      this.setActiveSession(newProfile, initialProgress);
      return { success: true, needsEmailConfirmation: false };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al crear la cuenta localmente' };
    }
  }

  /**
   * Inicio de Sesión (Sign In)
   */
  public async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const supabase = SupabaseService.getInstance();
    const client = supabase.client;

    // 1. Intentar con Supabase Auth
    if (client && supabase.isConnected()) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

        if (error) {
          // No ocultar errores de autenticación legítimos
          return { success: false, error: error.message };
        }

        if (data.session && data.user) {
          await this.loadUserProfileFromSupabase(data.user.id, data.user.email);
          await this.syncLocalDataToCloud(data.user.id);
          return { success: true };
        }
      } catch (err: any) {
        console.warn('[AuthService] Fallo de conectividad con Supabase SignIn, revisando modo local:', err);
      }
    }

    // 2. Modo Local-First
    try {
      const usersRaw = localStorage.getItem(STORAGE_KEY_LOCAL_USERS) || '[]';
      const localUsers: Array<{ email: string; passwordHash: string; profile: UserProfile; progress: UserProgress }> = JSON.parse(usersRaw);

      const found = localUsers.find((u) => u.email === cleanEmail && u.passwordHash === btoa(password));
      if (!found) {
        return { success: false, error: 'Credenciales inválidas. Verifica tu correo y contraseña.' };
      }

      found.progress.lastActiveAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_LOCAL_USERS, JSON.stringify(localUsers));

      this.setActiveSession(found.profile, found.progress);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al iniciar sesión' };
    }
  }

  /**
   * Cargar perfil y progreso desde Supabase (solo se ejecuta con sesión activa)
   */
  private async loadUserProfileFromSupabase(userId: string, email?: string): Promise<void> {
    const supabase = SupabaseService.getInstance();
    const client = supabase.client;
    if (!client) return;

    try {
      // 1. Cargar Perfil
      const { data: profileData, error: profileErr } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.warn('[AuthService] Error cargando perfil de Supabase:', profileErr.message);
      }

      // 2. Cargar Progreso
      const { data: progressData, error: progressErr } = await client
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (progressErr) {
        console.warn('[AuthService] Error cargando progreso de Supabase:', progressErr.message);
      }

      const profile: UserProfile = profileData
        ? {
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.full_name,
            targetLang: profileData.target_lang || 'en',
            currentLevel: profileData.current_level || 'A1',
            createdAt: profileData.created_at,
          }
        : {
            id: userId,
            email: email || 'usuario@mypolygloty.com',
            fullName: 'Estudiante',
            targetLang: 'en',
            currentLevel: 'A1',
            createdAt: new Date().toISOString(),
          };

      const progress: UserProgress = progressData
        ? {
            userId: progressData.user_id,
            streakDays: progressData.streak_days || 1,
            totalXp: progressData.total_xp || 0,
            totalTurns: progressData.total_turns || 0,
            totalLessons: progressData.total_lessons || 0,
            fluencyScore: progressData.fluency_score || 80,
            vocabScore: progressData.vocab_score || 78,
            grammarScore: progressData.grammar_score || 82,
            lastActiveAt: progressData.last_active_at || new Date().toISOString(),
          }
        : {
            userId: userId,
            streakDays: 1,
            totalXp: 50,
            totalTurns: 0,
            totalLessons: 0,
            fluencyScore: 82,
            vocabScore: 80,
            grammarScore: 84,
            lastActiveAt: new Date().toISOString(),
          };

      // 3. Cargar Memorias desde Supabase
      const { data: memoryRows } = await client
        .from('user_memory')
        .select('*')
        .eq('user_id', userId);

      if (memoryRows && memoryRows.length > 0) {
        const cloudMemories: UserMemoryItem[] = memoryRows.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          category: normalizeMemoryCategory(r.category),
          keyPhrase: r.key_phrase,
          memoryValue: r.memory_value,
          confidence: Number(r.confidence || 0.9),
          createdAt: r.created_at,
        }));
        localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(cloudMemories));
      }

      this.setActiveSession(profile, progress);
    } catch (err) {
      console.warn('[AuthService] Excepción al consultar datos en Supabase:', err);
    }
  }

  /**
   * Sincroniza datos locales pendientes hacia la nube según la regla:
   * - Progreso: Max-Accumulative (el mayor valor prevalece).
   * - Memoria: Unión aditiva deduplicada por key_phrase.
   */
  private async syncLocalDataToCloud(userId: string): Promise<void> {
    const supabase = SupabaseService.getInstance();
    const client = supabase.client;
    if (!client) return;

    try {
      // 1. Sincronizar Progreso si hay datos locales superiores
      const localProgRaw = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (localProgRaw && this.currentProgress) {
        const localProg: UserProgress = JSON.parse(localProgRaw);
        const mergedStreak = Math.max(localProg.streakDays || 1, this.currentProgress.streakDays || 1);
        const mergedXp = Math.max(localProg.totalXp || 0, this.currentProgress.totalXp || 0);
        const mergedTurns = Math.max(localProg.totalTurns || 0, this.currentProgress.totalTurns || 0);
        const mergedLessons = Math.max(localProg.totalLessons || 0, this.currentProgress.totalLessons || 0);

        if (
          mergedStreak > this.currentProgress.streakDays ||
          mergedXp > this.currentProgress.totalXp ||
          mergedTurns > this.currentProgress.totalTurns
        ) {
          this.currentProgress.streakDays = mergedStreak;
          this.currentProgress.totalXp = mergedXp;
          this.currentProgress.totalTurns = mergedTurns;
          this.currentProgress.totalLessons = mergedLessons;

          await client.from('user_progress').update({
            streak_days: mergedStreak,
            total_xp: mergedXp,
            total_turns: mergedTurns,
            total_lessons: mergedLessons,
            last_active_at: new Date().toISOString(),
          }).eq('user_id', userId);
        }
      }

      // 2. Sincronizar Memorias locales que no existan en la nube
      const rawMem = localStorage.getItem(STORAGE_KEY_MEMORIES) || '[]';
      const localMems: UserMemoryItem[] = JSON.parse(rawMem);

      const { data: cloudMemRows } = await client
        .from('user_memory')
        .select('key_phrase')
        .eq('user_id', userId);

      const cloudKeys = new Set((cloudMemRows || []).map((m: any) => m.key_phrase));

      for (const m of localMems) {
        if (!cloudKeys.has(m.keyPhrase)) {
          await client.from('user_memory').insert({
            user_id: userId,
            category: normalizeMemoryCategory(m.category),
            key_phrase: m.keyPhrase,
            memory_value: m.memoryValue,
            confidence: m.confidence || 0.9,
          });
        }
      }
    } catch (err) {
      console.warn('[AuthService] Fallo no fatal en syncLocalDataToCloud:', err);
    }
  }

  private setActiveSession(profile: UserProfile, progress: UserProgress): void {
    this.currentUser = profile;
    this.currentProgress = progress;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
    }
    this.notifySubscribers();
  }

  /**
   * Cierre de sesión (Sign Out)
   */
  public async signOut(): Promise<void> {
    const supabase = SupabaseService.getInstance();
    const client = supabase.client;

    if (client && client.auth) {
      try {
        await client.auth.signOut();
      } catch (_) {}
    }

    this.currentUser = null;
    this.currentProgress = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_PROGRESS);
    }
    this.notifySubscribers();
  }

  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public getCurrentProgress(): UserProgress | null {
    return this.currentProgress;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Actualiza el progreso del usuario tras una lección o conversación
   */
  public async recordProgress(delta: {
    turnsCompleted?: number;
    lessonsCompleted?: number;
    xpEarned?: number;
    fluencyScore?: number;
    vocabScore?: number;
    grammarScore?: number;
    level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  }): Promise<void> {
    if (!this.currentProgress) {
      this.currentProgress = {
        userId: this.currentUser?.id || 'guest',
        streakDays: 1,
        totalXp: 0,
        totalTurns: 0,
        totalLessons: 0,
        fluencyScore: 80,
        vocabScore: 78,
        grammarScore: 82,
        lastActiveAt: new Date().toISOString(),
      };
    }

    if (delta.turnsCompleted) this.currentProgress.totalTurns += delta.turnsCompleted;
    if (delta.lessonsCompleted) this.currentProgress.totalLessons += delta.lessonsCompleted;
    if (delta.xpEarned) this.currentProgress.totalXp += delta.xpEarned;
    if (delta.fluencyScore) this.currentProgress.fluencyScore = Math.round((this.currentProgress.fluencyScore + delta.fluencyScore) / 2);
    if (delta.vocabScore) this.currentProgress.vocabScore = Math.round((this.currentProgress.vocabScore + delta.vocabScore) / 2);
    if (delta.grammarScore) this.currentProgress.grammarScore = Math.round((this.currentProgress.grammarScore + delta.grammarScore) / 2);
    this.currentProgress.lastActiveAt = new Date().toISOString();

    if (this.currentUser && delta.level) {
      this.currentUser.currentLevel = delta.level;
    }

    // Persistir localmente
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(this.currentProgress));
      if (this.currentUser) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
      }
    }

    // Sincronizar en Supabase si está autenticado y en la nube
    const supabase = SupabaseService.getInstance();
    const client = supabase.client;
    const userId = await supabase.getActiveUserId();

    if (client && userId && this.currentUser && !this.currentUser.id.startsWith('local_user_')) {
      try {
        await client.from('user_progress').update({
          streak_days: this.currentProgress.streakDays,
          total_xp: this.currentProgress.totalXp,
          total_turns: this.currentProgress.totalTurns,
          total_lessons: this.currentProgress.totalLessons,
          fluency_score: this.currentProgress.fluencyScore,
          vocab_score: this.currentProgress.vocabScore,
          grammar_score: this.currentProgress.grammarScore,
          last_active_at: this.currentProgress.lastActiveAt,
        }).eq('user_id', userId);

        if (delta.level) {
          await client.from('profiles').update({ current_level: delta.level }).eq('id', userId);
        }
      } catch (err) {
        console.warn('[AuthService] Error sincronizando progreso con Supabase:', err);
      }
    }
  }

  /**
   * Gestión de Memoria Continua del Tutor (con validación de categoría)
   */
  public async addMemory(item: {
    category: string;
    keyPhrase: string;
    memoryValue: string;
    confidence: number;
  }): Promise<void> {
    const userId = this.currentUser?.id || 'guest';
    const safeCategory = normalizeMemoryCategory(item.category);

    const memoryItem: UserMemoryItem = {
      category: safeCategory,
      keyPhrase: item.keyPhrase,
      memoryValue: item.memoryValue,
      confidence: item.confidence,
      userId,
      createdAt: new Date().toISOString(),
    };

    // 1. Guardar localmente
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_MEMORIES) || '[]';
        const memories: UserMemoryItem[] = JSON.parse(raw);
        const existingIdx = memories.findIndex((m) => m.userId === userId && m.keyPhrase === memoryItem.keyPhrase);
        if (existingIdx >= 0) {
          memories[existingIdx] = memoryItem;
        } else {
          memories.push(memoryItem);
        }
        localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(memories));
      } catch (_) {}
    }

    // 2. Sincronizar en Supabase solo si hay sesión activa
    const supabase = SupabaseService.getInstance();
    const client = supabase.client;
    const activeUid = await supabase.getActiveUserId();

    if (client && activeUid && this.currentUser && !this.currentUser.id.startsWith('local_user_')) {
      try {
        await client.from('user_memory').insert({
          user_id: activeUid,
          category: safeCategory,
          key_phrase: memoryItem.keyPhrase,
          memory_value: memoryItem.memoryValue,
          confidence: memoryItem.confidence,
          created_at: memoryItem.createdAt,
          updated_at: memoryItem.createdAt,
        });
      } catch (err) {
        console.warn('[AuthService] Fallo al guardar memoria en Supabase:', err);
      }
    }
  }

  public getMemories(): UserMemoryItem[] {
    const userId = this.currentUser?.id || 'guest';
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MEMORIES) || '[]';
      const all: UserMemoryItem[] = JSON.parse(raw);
      return all.filter((m) => m.userId === userId);
    } catch (_) {
      return [];
    }
  }

  public onAuthStateChange(callback: (user: UserProfile | null) => void): () => void {
    this.authSubscribers.push(callback);
    return () => {
      this.authSubscribers = this.authSubscribers.filter((cb) => cb !== callback);
    };
  }

  private notifySubscribers(): void {
    this.authSubscribers.forEach((cb) => cb(this.currentUser));
  }
}
