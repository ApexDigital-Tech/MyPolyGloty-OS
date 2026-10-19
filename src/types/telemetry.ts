/**
 * Telemetría y Presupuesto de Latencia Extremo a Extremo (E2E) - MyPolyGloty OS
 * 
 * Basado en el estándar del Plan Maestro v2.0 (Auditoría Técnica Senior).
 * T1: Fin de Turno (VAD)
 * T2: Resampleo y Buffer en Cliente (AudioWorklet)
 * T3: Subida y STT (Groq Whisper / Deepgram)
 * T4: Inferencia LLM TTFT (Groq Llama 3.3 / Gemini 2.5 Flash)
 * T5: Sentence-level Chunking Buffer
 * T6: TTS First Audio Chunk (WebSocket)
 * T7: Playback Init y Buffer en Altavoz
 */

export interface LatencyBreakdown {
  t1_vadSilenceMs: number;     // Meta P50: 250ms, Límite P95: 350ms
  t2_clientBufferMs: number;   // Meta P50: 15ms,  Límite P95: 25ms
  t3_sttMs: number;            // Meta P50: 170ms, Límite P95: 240ms
  t4_llmFirstTokenMs: number;  // Meta P50: 170ms, Límite P95: 260ms
  t5_sentenceChunkMs: number;  // Meta P50: 25ms,  Límite P95: 40ms
  t6_ttsFirstChunkMs: number;  // Meta P50: 100ms, Límite P95: 180ms
  t7_playbackInitMs: number;   // Meta P50: 30ms,  Límite P95: 55ms
  totalTurnToEarMs: number;    // Meta P50: 760ms, Límite P95: 1150ms
  timestamp: number;
  turnIndex: number;
  status: 'optimal' | 'warning' | 'breach';
}

export const LATENCY_TARGETS = {
  P50_TARGET: 760,
  P95_LIMIT: 1150,
  CRITICAL_THRESHOLD: 1400,
  TRAMOS: {
    t1: { name: 'T1: VAD Silence Detection', p50: 250, p95: 350, desc: 'Ventana de silencio hasta confirmar fin de turno' },
    t2: { name: 'T2: AudioWorklet Buffer', p50: 15, p95: 25, desc: 'Resampleo directo Float32 -> Int16 16kHz en memoria' },
    t3: { name: 'T3: STT Transcription', p50: 170, p95: 240, desc: 'Transcripción con Groq Whisper LPU' },
    t4: { name: 'T4: LLM First Token (TTFT)', p50: 170, p95: 260, desc: 'Tiempo hasta el primer token con prompt caching' },
    t5: { name: 'T5: Sentence Chunking', p50: 25, p95: 40, desc: 'Acumulación de tokens hasta el primer delimitador (, . ? !)' },
    t6: { name: 'T6: TTS First Chunk', p50: 100, p95: 180, desc: 'Tiempo de síntesis del primer fragmento de voz' },
    t7: { name: 'T7: Audio Playback Init', p50: 30, p95: 55, desc: 'Doble buffer y arranque de reproducción en altavoz' },
  }
} as const;

export interface LatencyStats {
  count: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  breachCount: number;
}
