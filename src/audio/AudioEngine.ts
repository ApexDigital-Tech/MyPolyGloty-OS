/**
 * AudioEngine - MyPolyGloty OS (Sprint 0)
 * 
 * Gestiona el ciclo de vida de captura de audio en Web Audio API:
 * - Directivas de aislamiento y cancelación de eco (AEC).
 * - Carga e interconexión del AudioWorklet nativo.
 * - Resampleo continuo a PCM 16 kHz Mono en hilo secundario.
 * - Detección de silencios y disparadores de Barge-in.
 */

export interface AudioEngineConfig {
  sampleRate: number; // 16000
  vadThresholdRms: number; // Umbral de energía para habla
  vadSilenceTimeoutMs: number; // Tiempo de silencio para confirmar fin de turno
  echoCancellation: boolean;
  noiseSuppression: boolean;
}

export type PcmDataCallback = (data: {
  pcmBuffer: ArrayBuffer;
  samplesCount: number;
  rms: number;
  timestamp: number;
}) => void;

export type VoiceStateCallback = (state: 'speaking' | 'silent') => void;

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isRecording: boolean = false;
  private isSpeaking: boolean = false;
  private silenceTimer: number | null = null;
  private noiseFloor: number = 0.005;

  private onPcmCallback: PcmDataCallback | null = null;
  private onVoiceStateCallback: VoiceStateCallback | null = null;
  private onBargeInTrigger: (() => void) | null = null;

  public config: AudioEngineConfig = {
    sampleRate: 16000,
    vadThresholdRms: 0.025, // Ajustable según ruido ambiental
    vadSilenceTimeoutMs: 250, // Meta T1 P50: 250 ms
    echoCancellation: true,
    noiseSuppression: true,
  };

  private constructor() {}

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Inicializa el contexto de audio y carga el AudioWorkletProcessor.
   */
  public async initialize(): Promise<void> {
    if (this.audioContext && this.workletNode) {
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioCtx({ latencyHint: 'interactive' });

    // Cargar el procesador desde la ruta estática pública
    try {
      await this.audioContext.audioWorklet.addModule('/audio-processor.worklet.js');
    } catch (err) {
      console.error('Error cargando AudioWorklet polyglot-audio-processor:', err);
      throw new Error(`Fallo al cargar AudioWorklet: ${err}`);
    }
  }

  /**
   * Inicia la captura continua desde el micrófono con cancelación de eco y supresión de ruido.
   */
  public async startCapture(): Promise<void> {
    await this.initialize();
    if (!this.audioContext) throw new Error('AudioContext no inicializado');

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: this.config.echoCancellation,
        noiseSuppression: this.config.noiseSuppression,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    });

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'polyglot-audio-processor');

    this.workletNode.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'pcm_data') {
        this.handlePcmData(data);
      }
    };

    this.sourceNode.connect(this.workletNode);
    // No conectamos workletNode a audioContext.destination para evitar retorno de micrófono (feedback loop)
    this.isRecording = true;
    this.workletNode.port.postMessage({ action: 'start' });
  }

  /**
   * Detiene la captura de audio y libera los dispositivos.
   */
  public stopCapture(): void {
    this.isRecording = false;
    this.isSpeaking = false;

    if (this.silenceTimer) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.workletNode) {
      this.workletNode.port.postMessage({ action: 'stop' });
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Maneja el flujo de datos PCM emitidos por el AudioWorklet.
   */
  private handlePcmData(data: {
    pcm: ArrayBuffer;
    samplesCount: number;
    rms: number;
    timestamp: number;
  }): void {
    if (!this.isRecording) return;

    // Disparar callback de datos PCM
    if (this.onPcmCallback) {
      this.onPcmCallback({
        pcmBuffer: data.pcm,
        samplesCount: data.samplesCount,
        rms: data.rms,
        timestamp: data.timestamp,
      });
    }

    // Estimación adaptativa del piso de ruido ambiental (IIR slow filter)
    if (!this.isSpeaking) {
      this.noiseFloor = this.noiseFloor * 0.96 + data.rms * 0.04;
    }

    // Umbral dinámico adaptado al entorno del usuario
    const dynamicThreshold = Math.max(this.config.vadThresholdRms, this.noiseFloor * 2.5);
    const isAboveThreshold = data.rms > dynamicThreshold;

    if (isAboveThreshold) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        if (this.onVoiceStateCallback) this.onVoiceStateCallback('speaking');
        // Barge-in: Disparo ultra-rápido (<50ms) para interrumpir al tutor
        if (this.onBargeInTrigger) {
          this.onBargeInTrigger();
        }
      }

      // Reiniciar contador de silencio si sigue hablando
      if (this.silenceTimer) {
        window.clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (this.isSpeaking && !this.silenceTimer) {
      // Entró en ventana de silencio, arrancar temporizador de fin de turno
      this.silenceTimer = window.setTimeout(() => {
        this.isSpeaking = false;
        this.silenceTimer = null;
        if (this.onVoiceStateCallback) this.onVoiceStateCallback('silent');
      }, this.config.vadSilenceTimeoutMs);
    }
  }

  public setOnPcmData(cb: PcmDataCallback | null): void {
    this.onPcmCallback = cb;
  }

  public setOnVoiceState(cb: VoiceStateCallback | null): void {
    this.onVoiceStateCallback = cb;
  }

  public setOnBargeIn(cb: (() => void) | null): void {
    this.onBargeInTrigger = cb;
  }

  public get recording(): boolean {
    return this.isRecording;
  }

  public get speaking(): boolean {
    return this.isSpeaking;
  }
}
