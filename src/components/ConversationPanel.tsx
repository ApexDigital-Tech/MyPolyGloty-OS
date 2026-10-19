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
} from 'lucide-react';
import { SpeechRecognitionService } from '../services/speechRecognitionService';
import { TtsService } from '../services/ttsService';

export interface DialogueMessage {
  id: string;
  sender: 'tutor' | 'user';
  text: string;
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
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  messages,
  tutorStatus,
  userRms = 0,
  onSendMessage,
  onClearHistory,
  isSimulating,
  scenarioTitle = 'Entrevista Senior Frontend',
}) => {
  const [inputText, setInputText] = useState('');
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const speechRec = useRef(SpeechRecognitionService.getInstance());
  const tts = useRef(TtsService.getInstance());

  // Sugerencias estilo Praktika
  const smartSuggestions = [
    "I've worked on optimizing frontend bundle sizes using code splitting.",
    "Could you elaborate on the team's testing methodology?",
    "In my last role, we reduced latency by implementing Redis caching.",
    "I'm bad to speak in public... (Prueba de corrección gramatical)",
  ];

  // Auto-scroll al final en cada mensaje nuevo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tutorStatus, isSimulating]);

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

  // Reproducir audio con voz humana
  const handlePlayAudio = async (id: string, text: string) => {
    try {
      setPlayingMessageId(id);
      await tts.current.speakText(text, 'en-GB');
    } catch (_) {
    } finally {
      setPlayingMessageId(null);
    }
  };

  return (
    <div className="praktika-chat-card">
      {/* Cabecera estilo Praktika con Tutor */}
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
              <h2 className="tutor-heading">Alistair Vance</h2>
              <span className="accent-tag">en-GB</span>
              <span className="ai-tag">Tutor IA</span>
            </div>
            <div className="tutor-status-caption">
              {tutorStatus === 'idle' && `En espera · ${scenarioTitle}`}
              {tutorStatus === 'listening' && '👂 Escuchando tu voz...'}
              {tutorStatus === 'thinking' && '🧠 Pensando respuesta...'}
              {tutorStatus === 'speaking' && '🗣️ Hablando en vivo'}
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

      {/* Flujo de Mensajes estilo Praktika */}
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
                  <span className="msg-author">{isTutor ? 'Alistair' : 'Tú'}</span>
                  <span className="msg-time">{m.timestamp}</span>
                  {m.latencyMs && (
                    <span className="msg-latency-badge" title="Latencia Turn-to-Ear">
                      ⚡ {m.latencyMs}ms
                    </span>
                  )}
                </div>

                <div className={`praktika-msg-bubble ${isTutor ? 'tutor' : 'user'}`}>
                  <p className="bubble-text">{m.text}</p>

                  {/* Botón de reproducción de voz humana */}
                  {isTutor && (
                    <button
                      className={`btn-voice-replay ${isPlaying ? 'playing' : ''}`}
                      onClick={() => handlePlayAudio(m.id, m.text)}
                      title="Escuchar pronunciación nativa"
                      aria-label="Escuchar mensaje del tutor"
                    >
                      <Volume2 size={15} />
                      <span>{isPlaying ? 'Reproduciendo...' : 'Escuchar'}</span>
                    </button>
                  )}

                  {/* Feedback Quirúrgico & Did You Mean estilo Praktika */}
                  {m.grammarCorrection && (
                    <div className="praktika-inline-correction">
                      <div className="correction-header">
                        <Sparkles size={13} className="correction-icon" />
                        <span>Sugerencia pedagógica</span>
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
                <span className="typing-label">Alistair está formulando la respuesta...</span>
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

      {/* Sugerencias contextuales estilo Praktika */}
      <div className="praktika-suggestions-tray">
        <span className="tray-label">
          <HelpCircle size={12} /> Sugerencias de respuesta:
        </span>
        <div className="tray-chips-scroll">
          {smartSuggestions.map((s, idx) => (
            <button
              key={idx}
              className="suggestion-chip"
              onClick={() => onSendMessage(s)}
              disabled={isSimulating}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Barra de Entrada de Chat y Micrófono 100% Funcional */}
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
                ? 'Escuchando tu voz... habla en inglés'
                : 'Escribe tu respuesta en inglés aquí...'
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
