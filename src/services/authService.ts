/**
 * AuthService - Gestión de Autenticación, Usuarios y Sesiones
 * MyPolyGloty OS - Capa de Usuario y Cloud Sync
 * 
 * Funcionalidades:
 * 1. Registro (Sign Up) e Inicio de Sesión (Sign In) con Supabase Auth.
 * 2. Soporte Resiliente Local-First (Offline / Guest): Si Supabase no tiene anon key o está offline,
 *    almacena usuarios y progreso en localStorage sin interrumpir la experiencia.
 * 3. Gestión de estado de sesión global y persistencia entre recargas.
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

export interface UserMemoryItem {
  id?: number | string;
  userId: string;
  category: 'fact' | 'interest' | 'weakness' | 'goal' | 'preference';
  keyPhrase: string;
  memoryValue: string;
  confidence: number;
  createdAt?: string;
}

const STORAGE_KEY_USER = 'mypolygloty_active_user';
const STORAGE_KEY_PROGRESS = 'mypolygloty_user_progress';
const STORAGE_KEY_LOCAL_USERS = 'mypolygloty_local_registered_users';
const STORAGE_KEY_MEMORIES = 'mypolygloty_user_memories';

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
   * Restaura la sesión del usuario guardada localmente o desde Supabase
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
      console.warn('[AuthService] Error al restaurar sesión previa:', err);
    }

    // Escuchar eventos de sesión de Supabase Auth si está conectado
    const supabase = SupabaseService.getInstance();
    const client = (supabase as unknown as { client: any }).client;
    if (client && client.auth) {
      client.auth.onAuthStateChange(async (_event: string, session: any) => {
        if (session && session.user) {
          await this.loadUserProfileFromSupabase(session.user.id, session.user.email);
        } else if (_event === 'SIGNED_OUT') {
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
   */
  public async signUp(email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim() || 'Estudiante';
    const supabase = SupabaseService.getInstance();
    const client = (supabase as unknown as { client: any }).client;

    // 1. Intentar con Supabase Auth si está conectado
    if (client && supabase.isConnected()) {
      try {
        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: { full_name: cleanName },
          },
        });

        if (error) {
          return { success: false, error: error.message };
        }

        const userId = data.user?.id || `user_${Date.now()}`;
        const newProfile: UserProfile = {
          id: userId,
          email: cleanEmail,
          fullName: cleanName,
          targetLang: 'en',
          currentLevel: 'A1',
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

        // Guardar perfil y progreso en Supabase
        await client.from('profiles').upsert({
          id: userId,
          email: cleanEmail,
          full_name: cleanName,
          target_lang: 'en',
          current_level: 'A1',
          created_at: newProfile.createdAt,
          updated_at: newProfile.createdAt,
        });

        await client.from('user_progress').upsert({
          user_id: userId,
          streak_days: 1,
          total_xp: 50,
          total_turns: 0,
          total_lessons: 0,
          fluency_score: 82,
          vocab_score: 80,
          grammar_score: 84,
          last_active_at: initialProgress.lastActiveAt,
        });

        this.setActiveSession(newProfile, initialProgress);
        return { success: true };
      } catch (err: any) {
        console.warn('[AuthService] Fallo en Supabase SignUp, usando modo local:', err);
      }
    }

    // 2. Modo Local-First Resiliente (para pruebas offline o desarrollo)
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
        targetLang: 'en',
        currentLevel: 'A1',
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
        passwordHash: btoa(password), // Codificación simple para modo local
        profile: newProfile,
        progress: initialProgress,
      });

      localStorage.setItem(STORAGE_KEY_LOCAL_USERS, JSON.stringify(localUsers));
      this.setActiveSession(newProfile, initialProgress);
      return { success: true };
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
    const client = (supabase as unknown as { client: any }).client;

    // 1. Intentar con Supabase Auth
    if (client && supabase.isConnected()) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data.user) {
          await this.loadUserProfileFromSupabase(data.user.id, data.user.email);
          return { success: true };
        }
      } catch (err: any) {
        console.warn('[AuthService] Fallo en Supabase SignIn, revisando modo local:', err);
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

      // Actualizar última actividad
      found.progress.lastActiveAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_LOCAL_USERS, JSON.stringify(localUsers));

      this.setActiveSession(found.profile, found.progress);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al iniciar sesión' };
    }
  }

  /**
   * Cargar perfil y progreso desde Supabase
   */
  private async loadUserProfileFromSupabase(userId: string, email?: string): Promise<void> {
    const supabase = SupabaseService.getInstance();
    const client = (supabase as unknown as { client: any }).client;
    if (!client) return;

    try {
      const { data: profileData } = await client.from('profiles').select('*').eq('id', userId).single();
      const { data: progressData } = await client.from('user_progress').select('*').eq('user_id', userId).single();

      const profile: UserProfile = profileData
        ? {
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.full_name,
            targetLang: profileData.target_lang,
            currentLevel: profileData.current_level,
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
            streakDays: progressData.streak_days,
            totalXp: progressData.total_xp,
            totalTurns: progressData.total_turns,
            totalLessons: progressData.total_lessons,
            fluencyScore: progressData.fluency_score,
            vocabScore: progressData.vocab_score,
            grammarScore: progressData.grammar_score,
            lastActiveAt: progressData.last_active_at,
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

      this.setActiveSession(profile, progress);
    } catch (err) {
      console.warn('[AuthService] Error cargando perfil de Supabase:', err);
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
    const client = (supabase as unknown as { client: any }).client;

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
    const client = (supabase as unknown as { client: any }).client;
    if (client && this.currentUser && !this.currentUser.id.startsWith('local_user_')) {
      try {
        await client.from('user_progress').upsert({
          user_id: this.currentUser.id,
          streak_days: this.currentProgress.streakDays,
          total_xp: this.currentProgress.totalXp,
          total_turns: this.currentProgress.totalTurns,
          total_lessons: this.currentProgress.totalLessons,
          fluency_score: this.currentProgress.fluencyScore,
          vocab_score: this.currentProgress.vocabScore,
          grammar_score: this.currentProgress.grammarScore,
          last_active_at: this.currentProgress.lastActiveAt,
        });

        if (delta.level) {
          await client.from('profiles').update({ current_level: delta.level }).eq('id', this.currentUser.id);
        }
      } catch (err) {
        console.warn('[AuthService] Error sincronizando progreso con Supabase:', err);
      }
    }
  }

  /**
   * Gestión de Memoria Continua del Tutor
   */
  public async addMemory(item: Omit<UserMemoryItem, 'userId'>): Promise<void> {
    const userId = this.currentUser?.id || 'guest';
    const memoryItem: UserMemoryItem = {
      ...item,
      userId,
      createdAt: new Date().toISOString(),
    };

    // 1. Guardar localmente
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_MEMORIES) || '[]';
        const memories: UserMemoryItem[] = JSON.parse(raw);
        // Evitar duplicados exactos de la misma clave
        const existingIdx = memories.findIndex((m) => m.userId === userId && m.keyPhrase === memoryItem.keyPhrase);
        if (existingIdx >= 0) {
          memories[existingIdx] = memoryItem;
        } else {
          memories.push(memoryItem);
        }
        localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(memories));
      } catch (_) {}
    }

    // 2. Sincronizar en Supabase si está conectado
    const supabase = SupabaseService.getInstance();
    const client = (supabase as unknown as { client: any }).client;
    if (client && this.currentUser && !this.currentUser.id.startsWith('local_user_')) {
      try {
        await client.from('user_memory').insert({
          user_id: userId,
          category: memoryItem.category,
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
