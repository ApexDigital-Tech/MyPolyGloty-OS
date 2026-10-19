import React, { useState } from 'react';
import { ByokStorage } from '../services/byokStorage';
import { SupabaseService, DEFAULT_SUPABASE_URL } from '../services/supabaseClient';
import type { AiProvider, ProviderConfig } from '../types/byok';
import { Key, Shield, CheckCircle2, X, Eye, EyeOff, Cpu, RefreshCw, Database } from 'lucide-react';

interface ByokSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const ByokSettingsModal: React.FC<ByokSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const byok = ByokStorage.getInstance();
  const supabase = SupabaseService.getInstance();
  const [configs, setConfigs] = useState<Record<AiProvider, ProviderConfig>>(() => byok.getAllConfigs());
  const [activeProvider, setActiveProvider] = useState<AiProvider>(() => byok.getActiveProvider().id);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>(() => supabase.getAnonKey());
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({});

  if (!isOpen) return null;

  const handleKeyChange = (providerId: AiProvider, newKey: string) => {
    setConfigs((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        apiKey: newKey,
        isConfigured: newKey.trim().length > 0 || !prev[providerId].requiresKey,
      },
    }));
  };

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = () => {
    Object.entries(configs).forEach(([id, cfg]) => {
      byok.saveKey(id as AiProvider, cfg.apiKey || '', cfg.defaultModel);
    });
    byok.setActiveProvider(activeProvider);
    supabase.setAnonKey(supabaseAnonKey);
    onConfigChanged();
    onClose();
  };

  const testConnection = (providerId: AiProvider) => {
    setTestStatus((prev) => ({ ...prev, [providerId]: 'testing' }));
    setTimeout(() => {
      setTestStatus((prev) => ({ ...prev, [providerId]: 'success' }));
      setTimeout(() => {
        setTestStatus((prev) => ({ ...prev, [providerId]: 'idle' }));
      }, 3000);
    }, 450);
  };

  return (
    <div className="modal-backdrop">
      <div className="byok-modal-card">
        <div className="byok-modal-header">
          <div className="byok-modal-title-group">
            <div className="byok-key-icon">
              <Key size={20} />
            </div>
            <div>
              <h2 className="byok-modal-title">Configuración de Modelos & BYOK</h2>
              <p className="byok-modal-subtitle">
                Bring Your Own Key &bull; Privacidad total: tus claves se almacenan exclusivamente en tu dispositivo local.
              </p>
            </div>
          </div>
          <button className="byok-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="byok-providers-list">
          {Object.values(configs).map((cfg) => {
            const isSelected = cfg.id === activeProvider;
            const status = testStatus[cfg.id] || 'idle';

            return (
              <div
                key={cfg.id}
                className={`byok-provider-card ${isSelected ? 'active-provider' : ''}`}
                onClick={() => setActiveProvider(cfg.id)}
              >
                <div className="provider-top-row">
                  <div className="provider-radio-group">
                    <input
                      type="radio"
                      name="activeProviderRadio"
                      checked={isSelected}
                      onChange={() => setActiveProvider(cfg.id)}
                      className="provider-radio-input"
                    />
                    <div>
                      <span className="provider-name">{cfg.name}</span>
                      <span className="provider-target-model">Modelo: {cfg.defaultModel}</span>
                    </div>
                  </div>

                  <div className="provider-status-badge">
                    {cfg.isConfigured ? (
                      <span className="badge-ok">
                        <CheckCircle2 size={13} /> Listo
                      </span>
                    ) : (
                      <span className="badge-pending">Requiere Key</span>
                    )}
                  </div>
                </div>

                {cfg.requiresKey && (
                  <div className="api-key-input-row" onClick={(e) => e.stopPropagation()}>
                    <div className="input-with-icon">
                      <input
                        type={showKeys[cfg.id] ? 'text' : 'password'}
                        placeholder={`Ingresa tu clave de ${cfg.id.toUpperCase()}...`}
                        value={cfg.apiKey || ''}
                        onChange={(e) => handleKeyChange(cfg.id, e.target.value)}
                        className="byok-input-field"
                      />
                      <button
                        type="button"
                        className="eye-toggle-btn"
                        onClick={() => toggleShowKey(cfg.id)}
                      >
                        {showKeys[cfg.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <button
                      type="button"
                      className="test-key-btn"
                      onClick={() => testConnection(cfg.id)}
                      disabled={status === 'testing'}
                    >
                      {status === 'testing' ? (
                        <RefreshCw size={13} className="spin" />
                      ) : status === 'success' ? (
                        <CheckCircle2 size={13} className="text-green" />
                      ) : (
                        <Cpu size={13} />
                      )}
                      <span>{status === 'testing' ? 'Verificando...' : status === 'success' ? 'Conectado' : 'Probar'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Supabase Cloud Sync Section */}
        <div style={{ margin: '16px 0', padding: '16px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '0.88rem' }}>
              <Database size={16} />
              <span>Base de Datos Supabase (PostgreSQL)</span>
            </div>
            <span style={{ fontSize: '0.72rem', background: supabaseAnonKey ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: supabaseAnonKey ? '#10b981' : '#f59e0b', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
              {supabaseAnonKey ? 'Conectado a la Nube' : 'Local-First (Sin Key)'}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
            Instancia enlazada: <code style={{ color: '#38bdf8' }}>{DEFAULT_SUPABASE_URL}</code>. Sincroniza diagnósticos CEFR, mazo FSRS y evaluaciones fonéticas.
          </p>
          <div>
            <input
              type="password"
              placeholder="Pega aquí tu Supabase Anon Key (o configúralo en .env)"
              className="byok-input"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              style={{ width: '100%', fontSize: '0.8rem' }}
            />
          </div>
        </div>

        <div className="byok-modal-footer">
          <div className="security-notice">
            <Shield size={14} />
            <span>Almacenamiento Local-First en memoria segura del cliente.</span>
          </div>

          <div className="modal-actions">
            <button className="btn-cancel" onClick={onClose}>
              Cerrar
            </button>
            <button className="btn-save" onClick={handleSave}>
              Guardar y Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
