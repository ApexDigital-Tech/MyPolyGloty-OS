import React, { useState, useEffect, useRef } from 'react';
import { ParametricAvatar2D, type AvatarState } from './ParametricAvatar2D';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Bot,
  User,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Languages,
  ChevronDown,
  Flame,
  Gauge,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SpeechRecognitionService } from '../services/speechRecognitionService';
import { TtsService } from '../services/ttsService';
import {
  TutorFacilitatorService,
  type LearningLevel,
  type TargetLanguage,
  ROUTINES_CATALOG,
} from '../services/tutorFacilitatorService';

export interface DialogueMessage {
  id: string;
  sender: 'tutor' | 'user';
  text: string;
  translation?: string;
  timestamp: string;
  phoneticNotes?: string[];
  grammarCorrection?: {
    original: string;
    suggested: string;
    explanation: string;
  };
  latencyMs?: number;
}

interface ConversationPanelProps {
  messages: DialogueMessage[];
  tutorStatus: AvatarState;
  userRms?: number;
  onSendMessage: (text: string) => void;
  onClearHistory?: () => void;
  isSimulating: boolean;
  scenarioTitle?: string;
  currentLevel: LearningLevel;
  currentLanguage: TargetLanguage;
  speechRate: number;
  onLevelChange: (level: LearningLevel) => void;
  onLanguageChange: (lang: TargetLanguage) => void;
  onSpeechRateChange: (rate: number) => void;
  onRoutineSelect: (routineId: string) => void;
  sessionStats: {
    turnsCompleted: number;
    targetTurns: number;
    phaseName?: string;
    fluencyScore: number;
    vocabScore: number;
    grammarScore: number;
  };
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  messages,
  tutorStatus,
  userRms = 0,
  onSendMessage,
  onClearHistory,
  isSimulating,
  scenarioTitle = 'Práctica Conversacional',
  currentLevel,
  currentLanguage,
  speechRate,
  onLevelChange,
  onLanguageChange,
  onSpeechRateChange,
  onRoutineSelect,
  sessionStats,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showTranslations, setShowTranslations] = useState<boolean>(true);
  const [showRoutinesMenu, setShowRoutinesMenu] = useState<boolean>(false);
  const [showSuggestionsTray, setShowSuggestionsTray] = useState<boolean>(true);
  const [suggestionBatch, setSuggestionBatch] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const speechRec = useRef(SpeechRecognitionService.getInstance());
  const tts = useRef(TtsService.getInstance());
  const facilitator = TutorFacilitatorService.getInstance();

  const activeRoutine = facilitator.getActiveRoutine();

  // Sugerencias dinámicas y regenerables según nivel, idioma y batch
  const currentSuggestions = facilitator.getAlternativeSuggestions(
    currentLevel,
    currentLanguage,
    suggestionBatch
  );

  // Auto-scroll al final en cada mensaje nuevo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tutorStatus, isSimulating]);

  // Actualizar idioma en SpeechRecognition
  useEffect(() => {
    speechRec.current.setLanguage(currentLanguage === 'zh' ? 'zh-CN' : 'en-US');
  }, [currentLanguage]);

  // Manejar envío de texto
  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSimulating) return;

    if (isListeningMic) {
      speechRec.current.stopListening();
      setIsListeningMic(false);
    }

    onSendMessage(trimmed);
    setInputText('');
    setMicError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Toggle de micrófono con Web Speech API
  const handleToggleMic = () => {
    setMicError(null);

    if (isListeningMic) {
      speechRec.current.stopListening();
      setIsListeningMic(false);
      return;
    }

    const started = speechRec.current.startListening({
      onStart: () => {
        setIsListeningMic(true);
        setMicError(null);
      },
      onTranscript: (transcript, isFinal) => {
        setInputText(transcript);
        if (isFinal && transcript.trim()) {
          setIsListeningMic(false);
          onSendMessage(transcript.trim());
          setInputText('');
        }
      },
      onError: (err) => {
        setIsListeningMic(false);
        setMicError(err);
      },
      onEnd: () => {
        setIsListeningMic(false);
      },
    });

    if (!started && !speechRec.current.isSupported()) {
      setMicError('Micrófono no soportado en este navegador. Puedes escribir en el chat.');
    }
  };

  // Reproducir audio con voz humana y velocidad seleccionada
  const handlePlayAudio = async (id: string, text: string) => {
    try {
      setPlayingMessageId(id);
      const langCode = currentLanguage === 'zh' ? 'zh-CN' : 'en-GB';
      await tts.current.speakText(text, langCode, speechRate);
    } catch (_) {
    } finally {
      setPlayingMessageId(null);
    }
  };

  const progressPct = Math.min(100, Math.round((sessionStats.turnsCompleted / sessionStats.targetTurns) * 100));

  return (
    <div className="praktika-chat-card">
      {/* 1. Barra de Nivel & Idioma & Velocidad & Traducción */}
      <div className="facilitator-level-bar">
        {/* Selector de Idioma */}
        <div className="lang-selector-group">
          <button
            className={`lang-btn ${currentLanguage === 'en' ? 'active' : ''}`}
            onClick={() => onLanguageChange('en')}
            title="Aprender Inglés"
          >
            🇬🇧 English
          </button>
          <button
            className={`lang-btn ${currentLanguage === 'zh' ? 'active' : ''}`}
            onClick={() => onLanguageChange('zh')}
            title="Aprender Chino Mandarín"
          >
            🇨🇳 中文 Chino
          </button>
        </div>

        {/* Selector de Nivel CEFR Escalonado */}
        <div className="level-pills-row">
          {(['A1', 'A2', 'B1', 'B2', 'C1'] as LearningLevel[]).map((lvl) => (
            <button
              key={lvl}
              className={`level-pill-btn ${currentLevel === lvl ? 'active' : ''}`}
              onClick={() => onLevelChange(lvl)}
              title={`Nivel ${lvl} (${lvl === 'A1' ? 'Pausado y frases cortas' : 'Escalado'})`}
            >
              <span className="lvl-code">{lvl}</span>
              <span className="lvl-label">
                {lvl === 'A1' && 'Principiante'}
                {lvl === 'A2' && 'Básico'}
                {lvl === 'B1' && 'Intermedio'}
                {lvl === 'B2' && 'Avanzado'}
                {lvl === 'C1' && 'Maestría'}
              </span>
            </button>
          ))}
        </div>

        {/* Selector de Velocidad de Voz (A1 pausado) */}
        <div className="speed-selector-group" title="Velocidad del habla del tutor">
          <span className="speed-label">
            <Gauge size={13} /> Voz:
          </span>
          {[0.75, 0.85, 1.0, 1.2].map((rate) => (
            <button
              key={rate}
              className={`speed-pill-btn ${speechRate === rate ? 'active' : ''}`}
              onClick={() => onSpeechRateChange(rate)}
              title={
                rate === 0.75
                  ? '0.75x: Muy pausado (Ideal para A1)'
                  : rate === 0.85
                  ? '0.85x: Pausado moderado (A2)'
                  : rate === 1.0
                  ? '1.0x: Velocidad normal'
                  : '1.2x: Fluidez rápida'
              }
            >
              {rate === 0.75 ? '🐢 0.75x' : rate === 0.85 ? '0.85x' : rate === 1.0 ? '1.0x' : '🐇 1.2x'}
            </button>
          ))}
        </div>

        {/* Toggle de Traducciones Simultáneas en Español */}
        <button
          className={`btn-translation-toggle ${showTranslations ? 'active' : ''}`}
          onClick={() => setShowTranslations((prev) => !prev)}
          title="Mostrar u ocultar subtítulos de traducción en español"
        >
          <Languages size={15} />
          <span>Traducción: {showTranslations ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* 2. Barra de Medición Evaluada de Proceso & Fases en Progreso */}
      <div className="eval-progress-strip">
        <div className="progress-routine-info">
          <div className="routine-dropdown-anchor">
            <button
              className="routine-selector-btn"
              onClick={() => setShowRoutinesMenu((prev) => !prev)}
            >
              <span className="routine-icon">{activeRoutine.icon}</span>
              <span className="routine-title">{activeRoutine.title}</span>
              <ChevronDown size={14} />
            </button>

            {showRoutinesMenu && (
              <div className="routines-dropdown-menu">
                <span className="dropdown-title">Elige una Rutina de Práctica:</span>
                {ROUTINES_CATALOG.map((r) => (
                  <button
                    key={r.id}
                    className={`routine-item-btn ${r.id === activeRoutine.id ? 'selected' : ''}`}
                    onClick={() => {
                      onRoutineSelect(r.id);
                      setShowRoutinesMenu(false);
                    }}
                  >
                    <span className="item-icon">{r.icon}</span>
                    <div className="item-text">
                      <strong>{r.title}</strong>
                      <p>{r.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Micro-etapa en progreso */}
          <div className="phase-indicator-pill">
            <span className="phase-bullet" />
            <span className="phase-text">
              Etapa: <strong>{sessionStats.phaseName || facilitator.getCurrentPhaseName()}</strong>
            </span>
          </div>

          <div className="turn-progress-pill">
            <Flame size={13} className="flame-icon" />
            <span>Turno {sessionStats.turnsCompleted} de {sessionStats.targetTurns}</span>
          </div>
        </div>

        {/* Métricas de Evaluación Pedagógica */}
        <div className="eval-scores-group">
          <div className="score-badge" title="Puntuación de fluidez y cadencia">
            <span className="score-name">Fluidez:</span>
            <span className="score-val">{sessionStats.fluencyScore}%</span>
          </div>
          <div className="score-badge" title="Variedad y precisión de vocabulario">
            <span className="score-name">Vocab:</span>
            <span className="score-val">{sessionStats.vocabScore}%</span>
          </div>
          <div className="score-badge" title="Exactitud gramatical y sintáctica">
            <span className="score-name">Gramática:</span>
            <span className="score-val">{sessionStats.grammarScore}%</span>
          </div>
        </div>

        {/* Línea de progreso de la lección */}
        <div className="lesson-progress-bar">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* 3. Cabecera estilo Praktika con Tutor */}
      <div className="praktika-chat-header">
        <div className="tutor-profile-cluster">
          <div className="avatar-ring-container">
            <ParametricAvatar2D
              status={tutorStatus}
              userRms={userRms}
              width={64}
              height={64}
            />
            <span className={`status-badge-dot ${tutorStatus}`} />
          </div>

          <div className="tutor-profile-info">
            <div className="tutor-title-row">
              <h2 className="tutor-heading">
                {currentLanguage === 'zh' ? 'Li Wei (李伟)' : 'Alistair Vance'}
              </h2>
              <span className="accent-tag">{currentLanguage === 'zh' ? 'zh-CN' : 'en-GB'}</span>
              <span className="ai-tag">Nivel {currentLevel}</span>
              <span className="speed-indicator-tag">⚡ {speechRate}x</span>
            </div>
            <div className="tutor-status-caption">
              {tutorStatus === 'idle' && `Listo · ${scenarioTitle}`}
              {tutorStatus === 'listening' && '👂 Escuchando tu voz con paciencia...'}
              {tutorStatus === 'thinking' && '🧠 Evaluando gramática & preparando feedback...'}
              {tutorStatus === 'speaking' && `🗣️ Hablando en vivo (${speechRate}x)`}
            </div>
          </div>
        </div>

        <div className="header-actions">
          {onClearHistory && (
            <button
              className="btn-icon-subtle"
              onClick={onClearHistory}
              title="Reiniciar conversación"
              aria-label="Reiniciar conversación"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Flujo de Mensajes estilo Praktika con Traducción en Letras Pequeñas */}
      <div className="praktika-messages-container" role="log" aria-live="polite">
        {messages.map((m) => {
          const isTutor = m.sender === 'tutor';
          const isPlaying = playingMessageId === m.id;

          return (
            <div
              key={m.id}
              className={`praktika-msg-row ${isTutor ? 'from-tutor' : 'from-user'}`}
            >
              <div className="msg-avatar-col">
                {isTutor ? (
                  <div className="msg-avatar-icon tutor">
                    <Bot size={16} />
                  </div>
                ) : (
                  <div className="msg-avatar-icon user">
                    <User size={16} />
                  </div>
                )}
              </div>

              <div className="msg-content-col">
                <div className="msg-meta-header">
                  <span className="msg-author">{isTutor ? (currentLanguage === 'zh' ? 'Li Wei' : 'Alistair') : 'Tú'}</span>
                  <span className="msg-time">{m.timestamp}</span>
                  {m.latencyMs && (
                    <span className="msg-latency-badge" title="Latencia Turn-to-Ear">
                      ⚡ {m.latencyMs}ms
                    </span>
                  )}
                </div>

                <div className={`praktika-msg-bubble ${isTutor ? 'tutor' : 'user'}`}>
                  {/* Texto principal en el idioma meta */}
                  <p className="bubble-text">{m.text}</p>

                  {/* Traducción simultánea en letras pequeñas debajo de la frase */}
                  {showTranslations && m.translation && (
                    <div className="bubble-sub-translation">
                      <Languages size={11} className="sub-trans-icon" />
                      <span className="sub-trans-text">{m.translation}</span>
                    </div>
                  )}

                  {/* Botón de reproducción de voz humana con velocidad calibrada */}
                  {isTutor && (
                    <button
                      className={`btn-voice-replay ${isPlaying ? 'playing' : ''}`}
                      onClick={() => handlePlayAudio(m.id, m.text)}
                      title={`Escuchar a velocidad ${speechRate}x`}
                      aria-label="Escuchar mensaje del tutor"
                    >
                      <Volume2 size={15} />
                      <span>{isPlaying ? 'Reproduciendo...' : `Escuchar (${speechRate}x)`}</span>
                    </button>
                  )}

                  {/* Feedback Quirúrgico & Did You Mean estilo Praktika */}
                  {m.grammarCorrection && (
                    <div className="praktika-inline-correction">
                      <div className="correction-header">
                        <Sparkles size={13} className="correction-icon" />
                        <span>Sugerencia del Tutor:</span>
                      </div>
                      <div className="correction-body">
                        <span className="strike-text">{m.grammarCorrection.original}</span>
                        <span className="arrow">→</span>
                        <span className="fixed-text">{m.grammarCorrection.suggested}</span>
                      </div>
                      <p className="correction-explanation">{m.grammarCorrection.explanation}</p>
                    </div>
                  )}

                  {/* Notas Fonéticas */}
                  {m.phoneticNotes && m.phoneticNotes.length > 0 && (
                    <div className="praktika-phonetic-chips">
                      {m.phoneticNotes.map((note, idx) => (
                        <span key={idx} className="phonetic-chip">
                          <CheckCircle2 size={11} /> {note}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Indicador de pensamiento */}
        {isSimulating && (
          <div className="praktika-msg-row from-tutor">
            <div className="msg-avatar-col">
              <div className="msg-avatar-icon tutor">
                <Bot size={16} />
              </div>
            </div>
            <div className="msg-content-col">
              <div className="praktika-msg-bubble tutor thinking">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="typing-label">El tutor está respondiendo...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Alerta de Micrófono si hay error */}
      {micError && (
        <div className="praktika-alert-banner">
          <AlertCircle size={15} />
          <span>{micError}</span>
          <button className="btn-dismiss-alert" onClick={() => setMicError(null)}>
            ×
          </button>
        </div>
      )}

      {/* 5. Sugerencias Contextuales Opcionales & Regenerables */}
      <div className="praktika-suggestions-tray">
        <div className="tray-header-row">
          <span className="tray-label">
            <HelpCircle size={13} />
            <span>Alternativas de respuesta ({currentLevel}):</span>
          </span>

          <div className="tray-controls-group">
            <button
              className="btn-tray-tool"
              onClick={() => setSuggestionBatch((b) => b + 1)}
              title="Generar otras alternativas de respuesta"
            >
              <RefreshCw size={12} className="spin-on-hover" />
              <span>Regenerar</span>
            </button>

            <button
              className={`btn-tray-tool ${!showSuggestionsTray ? 'collapsed' : ''}`}
              onClick={() => setShowSuggestionsTray((prev) => !prev)}
              title={showSuggestionsTray ? 'Ocultar sugerencias para escribir por tu cuenta' : 'Mostrar sugerencias de ayuda'}
            >
              {showSuggestionsTray ? <EyeOff size={12} /> : <Eye size={12} />}
              <span>{showSuggestionsTray ? 'Ocultar' : 'Mostrar'}</span>
            </button>
          </div>
        </div>

        {showSuggestionsTray && (
          <div className="tray-chips-scroll">
            {currentSuggestions.map((s, idx) => (
              <button
                key={`${suggestionBatch}-${idx}`}
                className="suggestion-chip"
                onClick={() => onSendMessage(s.text)}
                disabled={isSimulating}
                title={s.translation}
              >
                <span className="chip-main-text">{s.text}</span>
                {showTranslations && <span className="chip-sub-trans">{s.translation}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 6. Barra de Entrada de Chat y Micrófono 100% Funcional */}
      <div className="praktika-input-bar">
        <button
          className={`btn-round-mic ${isListeningMic ? 'listening-active' : ''}`}
          onClick={handleToggleMic}
          disabled={isSimulating}
          title={isListeningMic ? 'Detener micrófono' : 'Hablar por micrófono'}
          aria-label={isListeningMic ? 'Detener grabación' : 'Iniciar grabación de voz'}
        >
          {isListeningMic ? <MicOff size={20} /> : <Mic size={20} />}
          {isListeningMic && <span className="mic-pulse-ring" />}
        </button>

        <div className="input-field-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="chat-text-input"
            placeholder={
              isListeningMic
                ? currentLanguage === 'zh'
                  ? 'Escuchando tu voz en chino...'
                  : 'Escuchando tu voz... habla en inglés'
                : currentLanguage === 'zh'
                ? 'Escribe en pinyin, chino o habla con tu tutor...'
                : currentLevel === 'A1'
                ? 'Responde fácil (ej: "Yes I do", "I like tea") o usa el micrófono...'
                : 'Escribe tu respuesta aquí o pulsa el micrófono...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSimulating}
          />
        </div>

        <button
          className="btn-send-message"
          onClick={handleSend}
          disabled={!inputText.trim() || isSimulating}
          title="Enviar mensaje"
          aria-label="Enviar mensaje"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
