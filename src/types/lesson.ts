import { z } from 'zod';

/**
 * Esquema de Lección y Escenario Abierto y Portable (lesson.json / pack.json)
 * MyPolyGloty OS - Estándar v2.0
 */

export const CefrBandSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export type CefrBand = z.infer<typeof CefrBandSchema>;

export const LanguageCodeSchema = z.enum([
  'en-US',
  'en-GB',
  'zh-CN', // Mandarín con soporte tonal
  'es-ES',
  'fr-FR',
  'de-DE',
  'ja-JP'
]);
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;

export const TargetPhonemeSchema = z.object({
  ipa: z.string().describe('Símbolo del Alfabeto Fonético Internacional, e.g. /θ/, /ʃ/, /v/'),
  wordExample: z.string(),
  description: z.string(),
  toneExpected: z.number().int().min(1).max(5).optional().describe('Para mandarín: tonos 1 a 4 o 5 (neutro)')
});

export const DialogueTurnSchema = z.object({
  role: z.enum(['system', 'tutor', 'user']),
  text: z.string(),
  targetPhonemes: z.array(z.string()).optional(),
  hints: z.array(z.string()).optional()
});

export const LessonMetadataSchema = z.object({
  id: z.string().uuid().or(z.string()),
  version: z.literal('2.0.0'),
  title: z.string().min(3),
  description: z.string(),
  targetLanguage: LanguageCodeSchema,
  cefrLevel: CefrBandSchema,
  durationMinutes: z.number().positive(),
  author: z.string().default('MyPolyGloty Community'),
  tags: z.array(z.string()).default([])
});

export const ScenarioContextSchema = z.object({
  situation: z.string().describe('Contexto ambiental e.g. "Entrevista técnica en una startup en Londres"'),
  tutorPersona: z.string().describe('Personalidad, tono y rol del tutor AI'),
  userRole: z.string().describe('Rol asignado al alumno'),
  goal: z.string().describe('Objetivo que el alumno debe conseguir comunicándose')
});

export const EvaluationRubricSchema = z.object({
  grammarFocus: z.array(z.string()),
  vocabularyList: z.array(z.string()),
  phoneticTargets: z.array(TargetPhonemeSchema),
  minPassingScore: z.number().min(0).max(100).default(70)
});

export const LessonPackSchema = z.object({
  metadata: LessonMetadataSchema,
  scenario: ScenarioContextSchema,
  rubric: EvaluationRubricSchema,
  starterDialogue: z.array(DialogueTurnSchema),
  rawSourceText: z.string().optional().describe('Texto o resumen de PDF si la lección fue generada con RAG personalizado')
});

export type LessonPack = z.infer<typeof LessonPackSchema>;
