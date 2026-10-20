-- ============================================================================
-- MyPolyGloty OS - Migration: Secure Schema v2 (Authenticated RLS & Auto-Triggers)
-- Project: https://rgnkwfgeivgfvqwcyiow.supabase.co
-- YA APLICADO en producción el 2026-10-20. No re-ejecutar.
-- ============================================================================

-- 1. Perfiles de Usuario (Vinculado a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Estudiante',
  avatar_url TEXT,
  target_lang TEXT NOT NULL DEFAULT 'en',
  current_level TEXT NOT NULL DEFAULT 'A1' CHECK (current_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Progreso General y Rachas por Usuario
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  streak_days INTEGER NOT NULL DEFAULT 1,
  total_xp INTEGER NOT NULL DEFAULT 0,
  total_turns INTEGER NOT NULL DEFAULT 0,
  total_lessons INTEGER NOT NULL DEFAULT 0,
  fluency_score INTEGER NOT NULL DEFAULT 80,
  vocab_score INTEGER NOT NULL DEFAULT 78,
  grammar_score INTEGER NOT NULL DEFAULT 82,
  last_active_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Memoria Continua del Tutor IA por Usuario
CREATE TABLE IF NOT EXISTS public.user_memory (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('fact', 'interest', 'weakness', 'goal', 'preference')),
  key_phrase TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.9,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Diagnósticos CEFR en 6 bandas (Sprint 4)
CREATE TABLE IF NOT EXISTS public.cefr_diagnostics (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  band TEXT NOT NULL CHECK (band IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  score NUMERIC NOT NULL,
  vocabulary_score NUMERIC NOT NULL,
  grammar_score NUMERIC NOT NULL,
  fluency_score NUMERIC NOT NULL,
  temporal_wpm NUMERIC NOT NULL,
  psychological_frictions JSONB DEFAULT '[]'::jsonb,
  turn_logs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Tarjetas de Repetición Espaciada FSRS v4.5 (Sprint 6)
CREATE TABLE IF NOT EXISTS public.fsrs_cards (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  target_lang TEXT NOT NULL DEFAULT 'en',
  card_type TEXT NOT NULL,
  ipa TEXT,
  context_sentence TEXT NOT NULL,
  due TIMESTAMPTZ NOT NULL,
  stability NUMERIC NOT NULL DEFAULT 0,
  difficulty NUMERIC NOT NULL DEFAULT 5.0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'new',
  last_review TIMESTAMPTZ,
  history JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Evaluaciones Fonéticas Quirúrgicas (Sprint 1 & Sprint 5)
CREATE TABLE IF NOT EXISTS public.phonetic_evaluations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_word TEXT NOT NULL,
  canonical_ipa TEXT NOT NULL,
  detected_ipa TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  formants JSONB,
  phonemes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. Sesiones y Diálogos Conversacionales
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scenario_title TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  total_latency_p50 INTEGER,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cefr_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsrs_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phonetic_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS RLS SEGURAS (Solo rol "authenticated". Cero acceso para rol "anon")
-- ============================================================================

-- 1. Profiles: Solo SELECT y UPDATE para el propio usuario (auth.uid() = id).
-- NOTA CRÍTICA: NO hay política de INSERT para el cliente. El trigger crea el registro.
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. User Progress
CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.user_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. User Memory (solo las 5 categorías permitidas validadas por CHECK)
CREATE POLICY "Users can view own memory"
  ON public.user_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory"
  ON public.user_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory"
  ON public.user_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory"
  ON public.user_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. CEFR Diagnostics
CREATE POLICY "Users can view own diagnostics"
  ON public.cefr_diagnostics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnostics"
  ON public.cefr_diagnostics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diagnostics"
  ON public.cefr_diagnostics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. FSRS Cards
CREATE POLICY "Users can view own fsrs_cards"
  ON public.fsrs_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fsrs_cards"
  ON public.fsrs_cards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fsrs_cards"
  ON public.fsrs_cards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own fsrs_cards"
  ON public.fsrs_cards FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Phonetic Evaluations
CREATE POLICY "Users can view own phonetic evaluations"
  ON public.phonetic_evaluations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own phonetic evaluations"
  ON public.phonetic_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 7. Conversation Sessions
CREATE POLICY "Users can view own conversation sessions"
  ON public.conversation_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation sessions"
  ON public.conversation_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation sessions"
  ON public.conversation_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER: Creación automática de profiles y user_progress al registrarse
-- Lee de raw_user_meta_data: full_name, target_lang, current_level
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_target_lang TEXT;
  v_current_level TEXT;
BEGIN
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'Estudiante');
  v_target_lang := COALESCE(new.raw_user_meta_data->>'target_lang', 'en');
  v_current_level := COALESCE(new.raw_user_meta_data->>'current_level', 'A1');
  
  IF v_current_level NOT IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') THEN
    v_current_level := 'A1';
  END IF;

  -- 1. Insertar perfil
  INSERT INTO public.profiles (id, email, full_name, target_lang, current_level)
  VALUES (new.id, new.email, v_full_name, v_target_lang, v_current_level)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        target_lang = EXCLUDED.target_lang,
        current_level = EXCLUDED.current_level,
        updated_at = NOW();

  -- 2. Insertar progreso inicial
  INSERT INTO public.user_progress (user_id, streak_days, total_xp, total_turns, total_lessons, fluency_score, vocab_score, grammar_score)
  VALUES (new.id, 1, 0, 0, 0, 80, 78, 82)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger disparado tras registrar usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
