/**
 * AudioWorkletProcessor para MyPolyGloty OS (Sprint 0)
 * 
 * Responsabilidades críticas:
 * 1. Capturar flujo de audio en hilo secundario sin interferir con la UI (Web Audio API).
 * 2. Resamplear dinámicamente de la tasa nativa del dispositivo (44.1/48 kHz) a 16 kHz Mono.
 * 3. Convertir Float32 a Int16 Little-Endian (PCM 16-bit) apto para STT y modelos acústicos.
 * 4. Calcular el nivel de energía RMS para VAD ultrarrápido y visualizadores.
 * 
 * Cero subprocesos de FFmpeg en la ruta caliente en vivo.
 */

class PolyglotAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.resampleRatio = sampleRate / this.targetSampleRate;
    this.inputBuffer = [];
    this.phase = 0;
    this.chunkSize = 2048; // ~128 ms a 16 kHz
    this.isActive = true;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.action === 'stop') {
        this.isActive = false;
      } else if (data && data.action === 'start') {
        this.isActive = true;
        this.inputBuffer = [];
        this.phase = 0;
      }
    };
  }

  process(inputs, outputs, parameters) {
    if (!this.isActive) return true;

    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    // Solo canal 0 (Mono)
    const channelData = input[0];
    const inputLength = channelData.length;

    // 1. Resampleo lineal de sampleRate nativo -> 16000 Hz
    const resampledLength = Math.floor((inputLength - this.phase) / this.resampleRatio);
    const pcmChunk = new Int16Array(resampledLength);
    let pcmIndex = 0;
    let sumSquares = 0;

    while (this.phase < inputLength && pcmIndex < resampledLength) {
      const index0 = Math.floor(this.phase);
      const index1 = Math.min(index0 + 1, inputLength - 1);
      const frac = this.phase - index0;

      // Interpolación lineal
      const sample = channelData[index0] * (1 - frac) + channelData[index1] * frac;
      
      // Acumular energía para cálculo RMS
      sumSquares += sample * sample;

      // Conversión Float32 [-1.0, 1.0] a Int16 [-32768, 32767] con clamp
      const clamped = Math.max(-1, Math.min(1, sample));
      pcmChunk[pcmIndex++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;

      this.phase += this.resampleRatio;
    }

    this.phase -= inputLength;

    // 2. Calcular RMS de este bloque
    const rms = Math.sqrt(sumSquares / (resampledLength || 1));

    // 3. Emitir chunk al hilo principal con transferencia de buffer
    if (pcmIndex > 0) {
      this.port.postMessage(
        {
          type: 'pcm_data',
          pcm: pcmChunk.buffer,
          samplesCount: pcmIndex,
          sampleRate: this.targetSampleRate,
          rms: rms,
          timestamp: currentTime
        },
        [pcmChunk.buffer]
      );
    }

    return true;
  }
}

registerProcessor('polyglot-audio-processor', PolyglotAudioProcessor);
