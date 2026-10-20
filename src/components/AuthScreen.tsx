import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Mail,
  Lock,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Flame,
  Award,
  Globe,
  LogIn,
  UserPlus,
  Loader2,
  Check,
} from 'lucide-react';
import { AuthService, type UserProfile } from '../services/authService';
import { SupabaseService } from '../services/supabaseClient';

export interface AuthScreenProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onAuthSuccess?: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetLang, setTargetLang] = useState<'en' | 'zh'>('en');
  const [currentLevel, setCurrentLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('A1');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sincronizar modo inicial cuando se abre
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const authService = AuthService.getInstance();
  const supabase = SupabaseService.getInstance();
  const isCloudConnected = supabase.isConnected();

  const handleModeSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim()) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (mode === 'register' && !fullName.trim()) {
      setError('Por favor ingresa tu nombre completo.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await authService.signUp(cleanEmail, password, fullName.trim());
        if (res.success) {
          // Si el usuario seleccionó un idioma o nivel específico, actualizamos el perfil local
          const currentUser = authService.getCurrentUser();
          if (currentUser) {
            currentUser.targetLang = targetLang;
            currentUser.currentLevel = currentLevel;
            localStorage.setItem('mypolygloty_active_user', JSON.stringify(currentUser));
          }

          setSuccessMsg('¡Cuenta creada exitosamente! Bienvenido a MyPolyGloty OS.');
          setTimeout(() => {
            onClose();
            const user = authService.getCurrentUser();
            if (user && onAuthSuccess) onAuthSuccess(user);
          }, 900);
        } else {
          setError(res.error || 'No se pudo crear la cuenta.');
        }
      } else {
        const res = await authService.signIn(cleanEmail, password);
        if (res.success) {
          setSuccessMsg('¡Sesión iniciada con éxito! Cargando tu progreso y memoria...');
          setTimeout(() => {
            onClose();
            const user = authService.getCurrentUser();
            if (user && onAuthSuccess) onAuthSuccess(user);
          }, 800);
        } else {
          setError(res.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen-overlay" role="dialog" aria-modal="true">
      <div className="auth-screen-container">
        {/* Barra superior de escape y navegación rápida */}
        <div className="auth-screen-topbar">
          <button
            type="button"
            className="btn-auth-back"
            onClick={onClose}
            aria-label="Volver a la lección"
          >
            <ArrowLeft size={16} />
            <span>Volver al Tutor</span>
          </button>

          <div className="auth-screen-badge-group">
            <div className={`auth-cloud-pill ${isCloudConnected ? 'connected' : 'local'}`}>
              <ShieldCheck size={13} />
              <span>{isCloudConnected ? 'Supabase Cloud Activo' : 'Modo Local-First Seguro'}</span>
            </div>
          </div>
        </div>

        {/* Estructura Principal Dividida: Showcase Pedagógico + Formulario Profesional */}
        <div className="auth-split-grid">
          {/* LADO IZQUIERDO: Showcase & Propuesta de Valor */}
          <div className="auth-showcase-panel">
            <div className="auth-brand-chip">
              <div className="brand-logo-glow">
                <Sparkles size={20} />
              </div>
              <div>
                <h1 className="brand-title">MyPolyGloty OS</h1>
                <span className="brand-subtitle">Tutor Pedagógico IA de Nueva Generación</span>
              </div>
            </div>

            <div className="showcase-content-body">
              <h2 className="showcase-headline">
                {mode === 'login'
                  ? 'Retoma tus conversaciones y mantén tu racha activa'
                  : 'Aprende inglés y chino hablando en situaciones reales'}
              </h2>
              <p className="showcase-description">
                {mode === 'login'
                  ? 'Tu tutor IA recuerda tus intereses, metas y áreas de mejora previas para que cada lección sea 100% personalizada.'
                  : 'Crea tu perfil para registrar tus rachas diarias, vocabulario evaluado con FSRS y análisis fonético de pronunciación.'}
              </p>

              {/* Tarjetas de Beneficios */}
              <div className="showcase-benefits-list">
                <div className="benefit-card">
                  <div className="benefit-icon-box flame">
                    <Flame size={18} />
                  </div>
                  <div className="benefit-texts">
                    <strong>Rachas y Progreso Continuo</strong>
                    <p>Sincronización de XP, métricas de fluidez, gramática y vocabulario.</p>
                  </div>
                </div>

                <div className="benefit-card">
                  <div className="benefit-icon-box brain">
                    <Sparkles size={18} />
                  </div>
                  <div className="benefit-texts">
                    <strong>Memoria Adaptativa del Tutor</strong>
                    <p>El facilitador IA recuerda tus mascotas, aficiones y correcciones clave.</p>
                  </div>
                </div>

                <div className="benefit-card">
                  <div className="benefit-icon-box cefr">
                    <Award size={18} />
                  </div>
                  <div className="benefit-texts">
                    <strong>Calibración por Niveles CEFR</strong>
                    <p>Velocidad de habla adaptada de 0.7x a 1.0x y micro-traducciones de apoyo.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonial o Nota de Confianza */}
            <div className="showcase-footer-quote">
              <p>“Hablar con el tutor me quitó el miedo a equivocarme. Es como tener un profesor nativo 24/7.”</p>
              <div className="quote-author">
                <span className="author-dot"></span>
                <span>Comunidad MyPolyGloty &bull; Práctica Fluida</span>
              </div>
            </div>
          </div>

          {/* LADO DERECHO: Formulario Dedicado e Independiente */}
          <div className="auth-form-panel">
            <div className="auth-form-card">
              {/* Encabezado específico de la pantalla */}
              <div className="auth-form-header">
                <div className="screen-mode-indicator">
                  {mode === 'login' ? (
                    <div className="mode-badge login">
                      <LogIn size={15} />
                      <span>Pantalla de Acceso</span>
                    </div>
                  ) : (
                    <div className="mode-badge register">
                      <UserPlus size={15} />
                      <span>Pantalla de Registro</span>
                    </div>
                  )}
                </div>

                <h2 className="auth-screen-title">
                  {mode === 'login' ? 'Iniciar Sesión' : 'Crea tu Cuenta de Alumno'}
                </h2>
                <p className="auth-screen-subtitle">
                  {mode === 'login'
                    ? 'Ingresa tus credenciales para acceder a tus métricas y memoria personalizada.'
                    : 'Regístrate para guardar tus avances y configurar tu plan de estudio.'}
                </p>
              </div>

              {/* Alertas de Error y Éxito */}
              {error && (
                <div className="auth-callout-box error" role="alert">
                  <AlertCircle size={16} className="callout-icon" />
                  <div className="callout-text">{error}</div>
                </div>
              )}

              {successMsg && (
                <div className="auth-callout-box success" role="status">
                  <CheckCircle2 size={16} className="callout-icon" />
                  <div className="callout-text">{successMsg}</div>
                </div>
              )}

              {/* Formulario */}
              <form className="auth-interactive-form" onSubmit={handleSubmit} noValidate>
                {/* Campo Nombre (solo en Registro) */}
                {mode === 'register' && (
                  <div className="auth-input-group">
                    <label htmlFor="reg-fullname" className="auth-label">
                      Nombre Completo
                    </label>
                    <div className="auth-input-wrap">
                      <User size={16} className="input-glyph" />
                      <input
                        id="reg-fullname"
                        type="text"
                        className="auth-field"
                        placeholder="Ej. Alex Rivera"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Campo Correo Electrónico */}
                <div className="auth-input-group">
                  <label htmlFor="auth-email" className="auth-label">
                    Correo Electrónico
                  </label>
                  <div className="auth-input-wrap">
                    <Mail size={16} className="input-glyph" />
                    <input
                      id="auth-email"
                      type="email"
                      className="auth-field"
                      placeholder="nombre@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                {/* Campo Contraseña */}
                <div className="auth-input-group">
                  <div className="label-with-hint">
                    <label htmlFor="auth-password" className="auth-label">
                      Contraseña
                    </label>
                    {mode === 'register' && (
                      <span className="field-hint">Mínimo 6 caracteres</span>
                    )}
                  </div>
                  <div className="auth-input-wrap">
                    <Lock size={16} className="input-glyph" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      className="auth-field"
                      placeholder={mode === 'login' ? '••••••••' : 'Crea una contraseña segura'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                    />
                    <button
                      type="button"
                      className="btn-toggle-eye"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Preferencias de Aprendizaje (Solo en Registro) */}
                {mode === 'register' && (
                  <div className="auth-preferences-section">
                    <div className="preference-group">
                      <label className="auth-label">
                        <Globe size={13} /> Idioma a Practicar:
                      </label>
                      <div className="lang-selector-pills">
                        <button
                          type="button"
                          className={`lang-pill-btn ${targetLang === 'en' ? 'active' : ''}`}
                          onClick={() => setTargetLang('en')}
                        >
                          <span>🇬🇧</span>
                          <span>Inglés</span>
                          {targetLang === 'en' && <Check size={12} className="check-mark" />}
                        </button>
                        <button
                          type="button"
                          className={`lang-pill-btn ${targetLang === 'zh' ? 'active' : ''}`}
                          onClick={() => setTargetLang('zh')}
                        >
                          <span>🇨🇳</span>
                          <span>Chino</span>
                          {targetLang === 'zh' && <Check size={12} className="check-mark" />}
                        </button>
                      </div>
                    </div>

                    <div className="preference-group">
                      <label className="auth-label">
                        <Award size={13} /> Nivel Inicial Sugerido:
                      </label>
                      <div className="cefr-level-selector">
                        {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            className={`cefr-lvl-btn ${currentLevel === lvl ? 'active' : ''}`}
                            onClick={() => setCurrentLevel(lvl)}
                            title={`Nivel CEFR ${lvl}`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Checkbox Recordarme en Login */}
                {mode === 'login' && (
                  <div className="auth-remember-row">
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="checkbox-label">Mantener mi sesión iniciada</span>
                    </label>
                  </div>
                )}

                {/* Botón Principal de Acción */}
                <button
                  type="submit"
                  className="btn-auth-primary-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="spin-loader" />
                      <span>{mode === 'login' ? 'Verificando...' : 'Creando cuenta...'}</span>
                    </>
                  ) : (
                    <>
                      {mode === 'login' ? (
                        <>
                          <LogIn size={18} />
                          <span>Iniciar Sesión en MyPolyGloty</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={18} />
                          <span>Crear Cuenta y Comenzar</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              </form>

              {/* Pie de pantalla: Enlace a la pantalla independiente complementaria */}
              <div className="auth-switch-screen-card">
                {mode === 'login' ? (
                  <div className="switch-prompt">
                    <span>¿Aún no tienes una cuenta de estudiante?</span>
                    <button
                      type="button"
                      className="btn-switch-screen"
                      onClick={() => handleModeSwitch('register')}
                    >
                      Crear Cuenta Nueva &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="switch-prompt">
                    <span>¿Ya tienes una cuenta registrada?</span>
                    <button
                      type="button"
                      className="btn-switch-screen"
                      onClick={() => handleModeSwitch('login')}
                    >
                      &larr; Iniciar Sesión Aquí
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
