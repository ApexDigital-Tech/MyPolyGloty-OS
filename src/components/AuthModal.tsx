import React, { useState } from 'react';
import { X, Lock, Mail, User, Sparkles, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { AuthService } from '../services/authService';
import { SupabaseService } from '../services/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const authService = AuthService.getInstance();
  const supabase = SupabaseService.getInstance();
  const isCloudConnected = supabase.isConnected();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await authService.signUp(email, password, fullName || 'Estudiante');
        if (res.success) {
          setSuccessMsg('¡Cuenta creada con éxito! Bienvenido a MyPolyGloty.');
          setTimeout(() => {
            onClose();
            if (onAuthSuccess) onAuthSuccess();
          }, 900);
        } else {
          setError(res.error || 'Error al crear la cuenta.');
        }
      } else {
        const res = await authService.signIn(email, password);
        if (res.success) {
          setSuccessMsg('¡Sesión iniciada con éxito! Cargando tu progreso...');
          setTimeout(() => {
            onClose();
            if (onAuthSuccess) onAuthSuccess();
          }, 800);
        } else {
          setError(res.error || 'Credenciales inválidas.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop-overlay" onClick={onClose}>
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Cabecera del Modal */}
        <div className="auth-modal-header">
          <div className="auth-brand-badge">
            <Sparkles size={22} className="brand-icon" />
          </div>
          <div className="auth-header-text">
            <h2 id="auth-modal-title" className="auth-modal-title">
              {mode === 'login' ? 'Bienvenido a MyPolyGloty' : 'Crea tu Cuenta de Aprendizaje'}
            </h2>
            <p className="auth-modal-subtitle">
              {mode === 'login'
                ? 'Accede para sincronizar tu progreso, historial y memoria del tutor.'
                : 'Guarda tus rachas, vocabulario FSRS y avance personalizado por nivel.'}
            </p>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Cerrar ventana">
            <X size={18} />
          </button>
        </div>

        {/* Indicador de Estado de Conexión a Base de Datos */}
        <div className={`auth-db-status-strip ${isCloudConnected ? 'cloud' : 'local'}`}>
          <ShieldCheck size={14} />
          <span>
            {isCloudConnected
              ? 'Conectado a Supabase Cloud (rgnkwfgeivgfvqwcyiow)'
              : 'Modo Local-First Activo (Tus datos se guardan en este dispositivo)'}
          </span>
        </div>

        {/* Pestañas Iniciar Sesión / Registro */}
        <div className="auth-tab-buttons">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Mensajes de Alerta y Éxito */}
        {error && (
          <div className="auth-alert-box error">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert-box success">
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group-field">
              <label htmlFor="reg-name" className="field-label">
                Nombre o Apodo
              </label>
              <div className="input-with-icon">
                <User size={16} className="field-icon" />
                <input
                  id="reg-name"
                  type="text"
                  className="auth-text-input"
                  placeholder="Ej: Alex, Laura..."
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="form-group-field">
            <label htmlFor="auth-email" className="field-label">
              Correo Electrónico
            </label>
            <div className="input-with-icon">
              <Mail size={16} className="field-icon" />
              <input
                id="auth-email"
                type="email"
                className="auth-text-input"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group-field">
            <label htmlFor="auth-pass" className="field-label">
              Contraseña
            </label>
            <div className="input-with-icon">
              <Lock size={16} className="field-icon" />
              <input
                id="auth-pass"
                type="password"
                className="auth-text-input"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="btn-auth-submit" disabled={loading}>
            <span>{loading ? 'Procesando...' : mode === 'login' ? 'Entrar a Mi Cuenta' : 'Registrarme y Comenzar'}</span>
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Pie de modal */}
        <div className="auth-modal-footer">
          {mode === 'login' ? (
            <p className="footer-switch-text">
              ¿No tienes una cuenta aún?{' '}
              <button type="button" className="btn-link-action" onClick={() => setMode('register')}>
                Regístrate gratis
              </button>
            </p>
          ) : (
            <p className="footer-switch-text">
              ¿Ya tienes cuenta creada?{' '}
              <button type="button" className="btn-link-action" onClick={() => setMode('login')}>
                Inicia sesión aquí
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
