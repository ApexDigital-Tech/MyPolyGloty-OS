/**
 * SpeechRecognitionService - Reconocimiento de Voz en Tiempo Real para MyPolyGloty OS
 * Soporta Web Speech API (Chrome/Edge/Android) con manejo de errores resiliente,
 * transcripción en vivo (interim + final) y fallback sin bloqueos.
 */

export interface SpeechRecognitionCallbacks {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export class SpeechRecognitionService {
  private static instance: SpeechRecognitionService | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private isListening: boolean = false;
  private lang: string = 'en-US';

  private constructor() {
    this.initRecognition();
  }

  public static getInstance(): SpeechRecognitionService {
    if (!SpeechRecognitionService.instance) {
      SpeechRecognitionService.instance = new SpeechRecognitionService();
    }
    return SpeechRecognitionService.instance;
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        this.recognition = new SpeechRec();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.recognition.lang = this.lang;
      } catch (e) {
        console.warn('[SpeechRecognition] Error instanciando SpeechRecognition:', e);
      }
    }
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  public setLanguage(lang: string): void {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public startListening(callbacks: SpeechRecognitionCallbacks): boolean {
    if (!this.recognition) {
      this.initRecognition();
    }

    if (!this.recognition) {
      callbacks.onError?.('El navegador no soporta Web Speech API nativa. Puedes escribir en el chat directamente.');
      return false;
    }

    if (this.isListening) {
      this.stopListening();
    }

    try {
      this.recognition.onstart = () => {
        this.isListening = true;
        callbacks.onStart?.();
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        if (finalTranscript.trim()) {
          callbacks.onTranscript(finalTranscript.trim(), true);
        } else if (interimTranscript.trim()) {
          callbacks.onTranscript(interimTranscript.trim(), false);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onerror = (event: any) => {
        console.warn('[SpeechRecognition] Error evento:', event.error);
        this.isListening = false;
        
        let msg = 'Error en captura de voz.';
        if (event.error === 'not-allowed') {
          msg = 'Permiso de micrófono denegado. Habilita el micrófono en la barra de direcciones o escribe en el chat.';
        } else if (event.error === 'no-speech') {
          msg = 'No se detectó voz. Vuelve a intentar o escribe tu mensaje.';
        } else if (event.error === 'audio-capture') {
          msg = 'No se encontró micrófono conectado.';
        }
        callbacks.onError?.(msg);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        callbacks.onEnd?.();
      };

      this.recognition.start();
      return true;
    } catch (err) {
      console.warn('[SpeechRecognition] Excepción al iniciar:', err);
      this.isListening = false;
      callbacks.onError?.('No se pudo iniciar el micrófono. Puedes escribir directamente en el chat.');
      return false;
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (_) {}
      this.isListening = false;
    }
  }

  public get active(): boolean {
    return this.isListening;
  }
}
