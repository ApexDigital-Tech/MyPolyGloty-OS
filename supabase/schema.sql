-- ============================================================================
-- MyPolyGloty OS - Supabase Database Schema
-- Project: https://rgnkwfgeivgfvqwcyiow.supabase.co
-- ============================================================================

-- 1. Diagnósticos CEFR en 6 bandas (Sprint 4)
CREATE TABLE IF NOT EXISTS public.cefr_diagnostics (
  id TEXT PRIMARY KEY,
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

-- 2. Tarjetas de Repetición Espaciada FSRS v4.5 (Sprint 6)
CREATE TABLE IF NOT EXISTS public.fsrs_cards (
  id TEXT PRIMARY KEY,
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

-- 3. Evaluaciones Fonéticas Quirúrgicas (Sprint 1 & Sprint 5)
CREATE TABLE IF NOT EXISTS public.phonetic_evaluations (
  id BIGSERIAL PRIMARY KEY,
  target_word TEXT NOT NULL,
  canonical_ipa TEXT NOT NULL,
  detected_ipa TEXT NOT NULL,
  overall_score INTEGER NOT NULL,
  formants JSONB,
  phonemes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Sesiones y Diálogos Conversacionales
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id TEXT PRIMARY KEY,
  scenario_title TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  total_latency_p50 INTEGER,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar Row Level Security (RLS) permisivo para anon key pública
ALTER TABLE public.cefr_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsrs_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phonetic_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para API pública (Lectura y Escritura permitida para el cliente web)
CREATE POLICY "Allow public read-write for cefr_diagnostics" ON public.cefr_diagnostics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for fsrs_cards" ON public.fsrs_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for phonetic_evaluations" ON public.phonetic_evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for conversation_sessions" ON public.conversation_sessions FOR ALL USING (true) WITH CHECK (true);
