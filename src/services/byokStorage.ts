/**
 * ByokStorage - Gestor de Almacenamiento Local Seguro de Credenciales BYOK
 * MyPolyGloty OS - Sprint 2
 */

import type { AiProvider, ProviderConfig } from '../types/byok';

const STORAGE_KEY = 'mypolygloty_byok_configs_v2';
const ACTIVE_PROVIDER_KEY = 'mypolygloty_active_provider_v2';

export const DEFAULT_PROVIDERS: Record<AiProvider, ProviderConfig> = {
  groq: {
    id: 'groq',
    name: 'Groq (LPU Cloud - Ultra Baja Latencia)',
    defaultModel: 'llama-3.3-70b-versatile',
    availableModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'whisper-large-v3'],
    requiresKey: true,
    isConfigured: false,
    endpoint: 'https://api.groq.com/openai/v1',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini (GenAI Cloud)',
    defaultModel: 'gemini-2.5-flash',
    availableModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    requiresKey: true,
    isConfigured: false,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT-4o Mini & Whisper)',
    defaultModel: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini', 'gpt-4o', 'whisper-1'],
    requiresKey: true,
    isConfigured: false,
    endpoint: 'https://api.openai.com/v1',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-20241022',
    availableModels: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    requiresKey: true,
    isConfigured: false,
    endpoint: 'https://api.anthropic.com/v1',
  },
  'local-mock': {
    id: 'local-mock',
    name: 'Simulador LPU Local (Cero Cloud / Latencia <200ms)',
    defaultModel: 'mock-llama-3.3-70b-lpu',
    availableModels: ['mock-llama-3.3-70b-lpu'],
    requiresKey: false,
    isConfigured: true,
  },
};

export class ByokStorage {
  private static instance: ByokStorage | null = null;
  private configs: Record<AiProvider, ProviderConfig>;
  private activeProvider: AiProvider;

  private constructor() {
    this.configs = this.loadConfigs();
    this.activeProvider = (localStorage.getItem(ACTIVE_PROVIDER_KEY) as AiProvider) || 'local-mock';
  }

  public static getInstance(): ByokStorage {
    if (!ByokStorage.instance) {
      ByokStorage.instance = new ByokStorage();
    }
    return ByokStorage.instance;
  }

  private loadConfigs(): Record<AiProvider, ProviderConfig> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_PROVIDERS, ...parsed };
      }
    } catch (e) {
      console.warn('Error leyendo BYOK configs de localStorage:', e);
    }
    return { ...DEFAULT_PROVIDERS };
  }

  public saveKey(provider: AiProvider, apiKey: string, selectedModel?: string): void {
    const trimmed = apiKey.trim();
    this.configs[provider] = {
      ...this.configs[provider],
      apiKey: trimmed,
      isConfigured: trimmed.length > 0 || !this.configs[provider].requiresKey,
      defaultModel: selectedModel || this.configs[provider].defaultModel,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.configs));
  }

  public removeKey(provider: AiProvider): void {
    if (this.configs[provider]) {
      this.configs[provider].apiKey = undefined;
      this.configs[provider].isConfigured = !this.configs[provider].requiresKey;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.configs));
    }
  }

  public setActiveProvider(provider: AiProvider): void {
    this.activeProvider = provider;
    localStorage.setItem(ACTIVE_PROVIDER_KEY, provider);
  }

  public getActiveProvider(): ProviderConfig {
    return this.configs[this.activeProvider] || this.configs['local-mock'];
  }

  public getAllConfigs(): Record<AiProvider, ProviderConfig> {
    return { ...this.configs };
  }
}
