-- ============================================================================
-- MyPolyGloty OS - Supabase Database Schema
-- Project: https://rgnkwfgeivgfvqwcyiow.supabase.co
-- Capa de Autenticación, Perfiles, Progreso y Memoria Continua del Tutor
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

-- 3. Memoria Continua del Tutor IA por Usuario (Hechos, Gustos, Debilidades)
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
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- Políticas de RLS para Profiles y Progress
CREATE POLICY "Public profiles are readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR auth.role() = 'anon');
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR auth.role() = 'anon');

CREATE POLICY "Users can read own progress" ON public.user_progress FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');
CREATE POLICY "Users can insert own progress" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'anon');
CREATE POLICY "Users can update own progress" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can read own memory" ON public.user_memory FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');
CREATE POLICY "Users can insert own memory" ON public.user_memory FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'anon');
CREATE POLICY "Users can update own memory" ON public.user_memory FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'anon');
CREATE POLICY "Users can delete own memory" ON public.user_memory FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'anon');

-- Políticas para Diagnósticos, FSRS, Fonética y Sesiones
CREATE POLICY "Allow public read-write for cefr_diagnostics" ON public.cefr_diagnostics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for fsrs_cards" ON public.fsrs_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for phonetic_evaluations" ON public.phonetic_evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for conversation_sessions" ON public.conversation_sessions FOR ALL USING (true) WITH CHECK (true);
