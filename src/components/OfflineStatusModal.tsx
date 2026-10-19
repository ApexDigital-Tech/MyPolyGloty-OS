import React, { useState, useEffect } from 'react';
import { OfflineOrchestrator, type RuntimeMode, type LocalModelConfig } from '../services/offlineOrchestrator';
import {
  Wifi,
  WifiOff,
  Server,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Activity,
} from 'lucide-react';

export const OfflineStatusModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const orchestrator = OfflineOrchestrator.getInstance();
  const [mode, setMode] = useState<RuntimeMode>(orchestrator.getMode());
  const [isOnline, setIsOnline] = useState<boolean>(orchestrator.isNetworkOnline());
  const [localConfig, setLocalConfig] = useState<LocalModelConfig>(orchestrator.getLocalConfig());
  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    return orchestrator.subscribe((m, online) => {
      setMode(m);
      setIsOnline(online);
      setLocalConfig(orchestrator.getLocalConfig());
    });
  }, [orchestrator]);

  if (!isOpen) return null;

  const handleTestOllama = async () => {
    setIsChecking(true);
    await orchestrator.checkLocalOllama();
    setLocalConfig(orchestrator.getLocalConfig());
    setIsChecking(false);
  };

  return (
    <div className="byok-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="byok-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '620px' }}
      >
        <div className="byok-modal-header">
          <div className="modal-title-group">
            <Cpu size={22} className="text-cyan" />
            <div>
              <h3>Arquitectura Local-First &amp; Conmutación Offline</h3>
              <p className="modal-subtitle">
                Garantía de privacidad, cero latencia de red y conmutación transparente en caso de corte.
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        {/* Status Banner */}
        <div
          className={`runtime-status-banner ${
            mode === 'cloud-byok'
              ? 'cloud'
              : mode === 'local-first'
              ? 'local'
              : 'fallback'
          }`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderRadius: '12px',
            margin: '16px 0 24px 0',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background:
              mode === 'cloud-byok'
                ? 'rgba(56, 189, 248, 0.12)'
                : mode === 'local-first'
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {isOnline ? (
              <Wifi size={24} style={{ color: '#38bdf8' }} />
            ) : (
              <WifiOff size={24} style={{ color: '#ef4444' }} />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>
                {mode === 'cloud-byok' && 'Modo Nube BYOK (Conectado)'}
                {mode === 'local-first' && 'Modo Local-First (Ollama 100% Offline)'}
                {mode === 'offline-fallback' && 'Modo Contingencia (Sin red / Cache local)'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.65)' }}>
                {isOnline
                  ? 'Conexión a internet estable con los LPU de Groq y Gemini Flash.'
                  : 'Sin conexión a internet. El audio y diálogo se procesan en tu hardware.'}
              </div>
            </div>
          </div>

          <span
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: isOnline ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: isOnline ? '#38bdf8' : '#ef4444',
            }}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Local Daemon Configuration */}
        <div className="local-daemon-section">
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#f3f4f6' }}>
            <Server size={16} /> Demonio Local de Inferencia (Ollama)
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                Endpoint Ollama
              </label>
              <input
                type="text"
                className="byok-input"
                value={localConfig.ollamaUrl}
                onChange={(e) =>
                  orchestrator.setLocalConfig({ ollamaUrl: e.target.value })
                }
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                Modelo Local
              </label>
              <input
                type="text"
                className="byok-input"
                value={localConfig.ollamaModel}
                onChange={(e) =>
                  orchestrator.setLocalConfig({ ollamaModel: e.target.value })
                }
                placeholder="llama3.2:3b / mistral-nemo"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {localConfig.isAvailable ? (
                <CheckCircle2 size={16} style={{ color: '#10b981' }} />
              ) : (
                <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
              )}
              <span style={{ fontSize: '0.82rem', color: localConfig.isAvailable ? '#10b981' : '#f59e0b' }}>
                {localConfig.isAvailable
                  ? 'Ollama está en ejecución y listo para fallback'
                  : 'Demonio Ollama no detectado en localhost:11434'}
              </span>
            </div>

            <button
              onClick={handleTestOllama}
              disabled={isChecking}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} className={isChecking ? 'spin' : ''} />
              <span>Verificar Conexión</span>
            </button>
          </div>
        </div>

        {/* Whisper Local & Storage Info */}
        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
              <HardDrive size={15} style={{ color: '#a78bfa' }} />
              <span>Almacenamiento Local</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              SQLite / IndexedDB persistiendo tarjetas FSRS, grabaciones WAV y telemetría sin enviar datos a servidores externos.
            </p>
          </div>

          <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
              <Activity size={15} style={{ color: '#38bdf8' }} />
              <span>STT Whisper Local</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Whisper.cpp / WebGPU activado automáticamente cuando la latencia de red supera los 1500ms o se pierde el enlace.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="byok-save-btn"
            style={{ width: 'auto', padding: '8px 24px' }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
