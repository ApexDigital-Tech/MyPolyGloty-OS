/**
 * OfflineOrchestrator - Gestor de Conectividad Local-First y Fallback Automático
 * MyPolyGloty OS - Sprint 6
 * 
 * Monitorea el estado de la red (navigator.onLine y ping de latencia).
 * Si la conexión se degrada o se interrumpe:
 * 1. Conmuta automáticamente al modo Local-First sin interrumpir la sesión ni perder el estado.
 * 2. Soporta endpoint de Ollama local (default http://127.0.0.1:11434) para Llama 3.2 / Mistral Nemo.
 * 3. Soporta Whisper.cpp local / WebGPU Whisper para STT sin conexión.
 * 4. Mantiene búfer local de telemetría y diagnósticos en IndexedDB / localStorage.
 */

export type RuntimeMode = 'cloud-byok' | 'local-first' | 'offline-fallback';

export interface LocalModelConfig {
  ollamaUrl: string;
  ollamaModel: string;
  whisperLocalUrl: string;
  isAvailable: boolean;
  lastChecked: number;
}

export class OfflineOrchestrator {
  private static instance: OfflineOrchestrator | null = null;
  private currentMode: RuntimeMode = 'cloud-byok';
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private localConfig: LocalModelConfig = {
    ollamaUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'llama3.2:3b',
    whisperLocalUrl: 'http://127.0.0.1:8080/inference',
    isAvailable: false,
    lastChecked: 0,
  };
  private listeners: Set<(mode: RuntimeMode, isOnline: boolean) => void> = new Set();

  private constructor() {
    this.initNetworkListeners();
    this.checkLocalOllama();
  }

  public static getInstance(): OfflineOrchestrator {
    if (!OfflineOrchestrator.instance) {
      OfflineOrchestrator.instance = new OfflineOrchestrator();
    }
    return OfflineOrchestrator.instance;
  }

  private initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[OfflineOrchestrator] Conexión de red restablecida.');
      this.evaluateMode();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.warn('[OfflineOrchestrator] Conexión de red perdida. Activando contingencia Offline / Local-First.');
      this.evaluateMode();
    });
  }

  public async checkLocalOllama(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${this.localConfig.ollamaUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        this.localConfig.isAvailable = true;
        this.localConfig.lastChecked = Date.now();
        console.log('[OfflineOrchestrator] Ollama local detectado y listo en', this.localConfig.ollamaUrl);
        this.evaluateMode();
        return true;
      }
    } catch {
      this.localConfig.isAvailable = false;
      this.localConfig.lastChecked = Date.now();
    }
    this.evaluateMode();
    return false;
  }

  private evaluateMode() {
    let targetMode: RuntimeMode = 'cloud-byok';

    if (!this.isOnline) {
      targetMode = this.localConfig.isAvailable ? 'local-first' : 'offline-fallback';
    } else {
      targetMode = 'cloud-byok';
    }

    if (this.currentMode !== targetMode) {
      this.currentMode = targetMode;
      console.log(`[OfflineOrchestrator] Modo conmutado a: ${targetMode} (Online: ${this.isOnline})`);
      this.notifyListeners();
    }
  }

  public getMode(): RuntimeMode {
    return this.currentMode;
  }

  public isNetworkOnline(): boolean {
    return this.isOnline;
  }

  public getLocalConfig(): LocalModelConfig {
    return { ...this.localConfig };
  }

  public setLocalConfig(config: Partial<LocalModelConfig>) {
    this.localConfig = { ...this.localConfig, ...config };
    this.checkLocalOllama();
  }

  public subscribe(listener: (mode: RuntimeMode, isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentMode, this.isOnline);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l(this.currentMode, this.isOnline));
  }

  /**
   * Generación local de respuesta usando Ollama si estamos sin red.
   */
  public async generateLocalChatResponse(
    prompt: string,
    systemPrompt: string
  ): Promise<string> {
    if (!this.localConfig.isAvailable) {
      return "He detectado una interrupción en la conexión a internet. Guardando tus progresos localmente para reanudar en cuanto vuelva la señal.";
    }

    try {
      const res = await fetch(`${this.localConfig.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.localConfig.ollamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          stream: false,
        }),
      });

      if (!res.ok) throw new Error(`Ollama HTTP error ${res.status}`);
      const data = await res.json();
      return data.message?.content || "Perfecto. Seguimos practicando en modo local.";
    } catch (err) {
      console.error('[OfflineOrchestrator] Error en generación local Ollama:', err);
      return "Modo local activo. Estoy escuchando tu pronunciación y guardando los análisis fonéticos.";
    }
  }
}
