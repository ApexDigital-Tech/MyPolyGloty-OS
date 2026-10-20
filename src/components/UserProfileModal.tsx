import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Flame,
  Award,
  BookOpen,
  Brain,
  Trash2,
  Plus,
  LogOut,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { AuthService, type UserProfile, type UserProgress, type UserMemoryItem } from '../services/authService';
import { SupabaseService } from '../services/supabaseClient';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, onLogout }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [memories, setMemories] = useState<UserMemoryItem[]>([]);
  const [newMemoryKey, setNewMemoryKey] = useState('');
  const [newMemoryValue, setNewMemoryValue] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<'interest' | 'fact' | 'weakness' | 'goal' | 'preference'>('interest');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const authService = AuthService.getInstance();
  const supabase = SupabaseService.getInstance();
  const isCloudConnected = supabase.isConnected();

  const loadData = () => {
    setUser(authService.getCurrentUser());
    setProgress(authService.getCurrentProgress());
    setMemories(authService.getMemories());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryKey.trim() || !newMemoryValue.trim()) return;

    await authService.addMemory({
      category: newMemoryCategory,
      keyPhrase: newMemoryKey.trim(),
      memoryValue: newMemoryValue.trim(),
      confidence: 1.0,
    });

    setNewMemoryKey('');
    setNewMemoryValue('');
    setMemories(authService.getMemories());
  };

  const handleDeleteMemory = (indexToDelete: number) => {
    try {
      const raw = localStorage.getItem('mypolygloty_user_memories') || '[]';
      const all: UserMemoryItem[] = JSON.parse(raw);
      const filtered = all.filter((_, idx) => idx !== indexToDelete);
      localStorage.setItem('mypolygloty_user_memories', JSON.stringify(filtered));
      setMemories(authService.getMemories());
    } catch (_) {}
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Sincronizando con base de datos...');

    if (progress) {
      await authService.recordProgress({
        fluencyScore: progress.fluencyScore,
        vocabScore: progress.vocabScore,
        grammarScore: progress.grammarScore,
      });
    }

    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatus('¡Datos sincronizados correctamente!');
      setTimeout(() => setSyncStatus(null), 2500);
    }, 700);
  };

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div
        className="profile-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        {/* Cabecera del Perfil */}
        <div className="profile-modal-header">
          <div className="profile-avatar-large">
            <User size={30} className="avatar-icon" />
          </div>
          <div className="profile-details-group">
            <h2 id="profile-modal-title" className="profile-user-name">
              {user.fullName}
            </h2>
            <span className="profile-user-email">{user.email}</span>
            <div className="profile-badges-row">
              <span className="profile-level-badge">Nivel {user.currentLevel}</span>
              <span className="profile-lang-badge">{user.targetLang === 'zh' ? '🇨🇳 Chino' : '🇬🇧 Inglés'}</span>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Cerrar perfil">
            <X size={18} />
          </button>
        </div>

        {/* Estado de sincronización en la nube */}
        <div className={`auth-db-status-strip ${isCloudConnected ? 'cloud' : 'local'}`}>
          <ShieldCheck size={14} />
          <span>
            {isCloudConnected
              ? 'Conectado a Supabase Cloud (rgnkwfgeivgfvqwcyiow)'
              : 'Modo Local-First (Sincronización en caché del navegador)'}
          </span>
          <button className="btn-sync-trigger" onClick={handleManualSync} disabled={isSyncing}>
            <RefreshCw size={12} className={isSyncing ? 'spin-anim' : ''} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>

        {syncStatus && (
          <div className="profile-sync-feedback">
            <CheckCircle2 size={13} />
            <span>{syncStatus}</span>
          </div>
        )}

        {/* Tablero de Métricas y Progreso Evaluado */}
        <div className="profile-metrics-grid">
          <div className="metric-card">
            <div className="metric-icon-wrap streak">
              <Flame size={18} />
            </div>
            <div className="metric-info">
              <span className="metric-value">{progress?.streakDays || 1} días</span>
              <span className="metric-label">Racha Activa</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-wrap xp">
              <Award size={18} />
            </div>
            <div className="metric-info">
              <span className="metric-value">{progress?.totalXp || 50} XP</span>
              <span className="metric-label">Puntos de Avance</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-wrap lessons">
              <BookOpen size={18} />
            </div>
            <div className="metric-info">
              <span className="metric-value">{progress?.totalTurns || 0} turnos</span>
              <span className="metric-label">Práctica Realizada</span>
            </div>
          </div>
        </div>

        {/* Puntuaciones de Proceso */}
        <div className="profile-scores-summary">
          <div className="score-item">
            <span className="score-title">Fluidez:</span>
            <div className="score-meter">
              <div className="score-bar-fill fluency" style={{ width: `${progress?.fluencyScore || 80}%` }} />
            </div>
            <span className="score-num">{progress?.fluencyScore || 80}%</span>
          </div>

          <div className="score-item">
            <span className="score-title">Vocabulario:</span>
            <div className="score-meter">
              <div className="score-bar-fill vocab" style={{ width: `${progress?.vocabScore || 78}%` }} />
            </div>
            <span className="score-num">{progress?.vocabScore || 78}%</span>
          </div>

          <div className="score-item">
            <span className="score-title">Gramática:</span>
            <div className="score-meter">
              <div className="score-bar-fill grammar" style={{ width: `${progress?.grammarScore || 82}%` }} />
            </div>
            <span className="score-num">{progress?.grammarScore || 82}%</span>
          </div>
        </div>

        {/* Memoria Continua del Tutor (Qué sabe el tutor de mí) */}
        <div className="profile-memory-section">
          <div className="memory-section-header">
            <div className="memory-title-wrap">
              <Brain size={16} className="brain-icon" />
              <h3>Memoria Continua del Tutor</h3>
            </div>
            <span className="memory-count-pill">{memories.length} recuerdos</span>
          </div>
          <p className="memory-desc">
            El tutor recuerda estos detalles sobre ti para personalizar cada conversación y adaptar el vocabulario:
          </p>

          <div className="memories-list-box">
            {memories.length === 0 ? (
              <p className="no-memories-msg">
                Aún no hay recuerdos guardados. A medida que converses con el tutor, irá recordando tus gustos, mascotas
                y temas preferidos.
              </p>
            ) : (
              memories.map((mem, idx) => (
                <div key={idx} className="memory-item-row">
                  <span className={`memory-cat-tag ${mem.category}`}>
                    {mem.category === 'interest' && 'Interés'}
                    {mem.category === 'fact' && 'Dato'}
                    {mem.category === 'weakness' && 'A Mejorar'}
                    {mem.category === 'goal' && 'Meta'}
                    {mem.category === 'preference' && 'Gusto'}
                  </span>
                  <div className="memory-content">
                    <strong>{mem.keyPhrase}:</strong>
                    <span>{mem.memoryValue}</span>
                  </div>
                  <button
                    className="btn-delete-memory"
                    onClick={() => handleDeleteMemory(idx)}
                    title="Olvidar este dato"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Formulario rápido para agregar memoria manual */}
          <form className="add-memory-form" onSubmit={handleAddMemory}>
            <select
              className="memory-cat-select"
              value={newMemoryCategory}
              onChange={(e) => setNewMemoryCategory(e.target.value as any)}
            >
              <option value="interest">Interés</option>
              <option value="goal">Meta</option>
              <option value="fact">Dato</option>
              <option value="weakness">Debilidad</option>
              <option value="preference">Gusto / Preferencia</option>
            </select>
            <input
              type="text"
              className="memory-input-key"
              placeholder="Tema (ej. Mascotas, Café)"
              value={newMemoryKey}
              onChange={(e) => setNewMemoryKey(e.target.value)}
            />
            <input
              type="text"
              className="memory-input-val"
              placeholder="Detalle (ej. Tengo un perro llamado Toby)"
              value={newMemoryValue}
              onChange={(e) => setNewMemoryValue(e.target.value)}
            />
            <button type="submit" className="btn-add-memory" disabled={!newMemoryKey || !newMemoryValue}>
              <Plus size={14} />
              <span>Guardar</span>
            </button>
          </form>
        </div>

        {/* Acciones de pie: Cerrar sesión */}
        <div className="profile-modal-footer">
          <button className="btn-logout" onClick={onLogout}>
            <LogOut size={15} />
            <span>Cerrar Sesión</span>
          </button>
          <button className="btn-primary-close" onClick={onClose}>
            Aceptar y Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
