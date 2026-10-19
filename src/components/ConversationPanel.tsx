import React from 'react';
import { ParametricAvatar2D, type AvatarState } from './ParametricAvatar2D';
import { Bot, User, Sparkles, Volume2, ShieldAlert } from 'lucide-react';

export interface DialogueMessage {
  id: string;
  sender: 'tutor' | 'user';
  text: string;
  timestamp: string;
  phoneticNotes?: string[];
  latencyMs?: number;
}

interface ConversationPanelProps {
  messages: DialogueMessage[];
  tutorStatus: AvatarState;
  userRms?: number;
  onUserSpeakSample: (text: string) => void;
  isSimulating: boolean;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  messages,
  tutorStatus,
  userRms = 0,
  onUserSpeakSample,
  isSimulating,
}) => {
  const samplePrompts = [
    {
      label: 'Respuesta B1 con errores comunes (/v/ y /θ/)',
      text: "I have developed a very fast caching system that improved the throughput of our application.",
    },
    {
      label: 'Respuesta fluida avanzada (casi nativa)',
      text: "In my previous role, we refactored the state architecture to eliminate race conditions and reduce latency.",
    },
    {
      label: 'Respuesta con vacilación y pausas',
      text: "Well... I think... the main bottleneck was in the database queries, so we added indexing.",
    },
  ];

  return (
    <div className="conversation-panel-card">
      <div className="conv-header">
        <div className="conv-tutor-identity">
          <div className="avatar-canvas-compact-wrapper">
            <ParametricAvatar2D
              status={tutorStatus}
              userRms={userRms}
              width={72}
              height={72}
            />
          </div>
          <div>
            <div className="tutor-name">Alistair Vance (Tutor AI)</div>
            <div className="tutor-status-text">
              {tutorStatus === 'idle' && 'En espera'}
              {tutorStatus === 'listening' && '👂 Escuchando tu voz...'}
              {tutorStatus === 'thinking' && '🧠 Evaluando gramática & generando respuesta...'}
              {tutorStatus === 'speaking' && '🗣️ Hablando (TTS Streaming & Lip-Sync)...'}
            </div>
          </div>
        </div>

        <div className="barge-in-badge" title="Si comienzas a hablar, el tutor se detendrá en <50ms">
          <ShieldAlert size={13} />
          <span>Barge-in Armado</span>
        </div>
      </div>

      <div className="conv-messages-scroll">
        {messages.map((m) => (
          <div key={m.id} className={`message-bubble-wrapper ${m.sender}`}>
            <div className="message-sender-tag">
              {m.sender === 'tutor' ? <Bot size={13} /> : <User size={13} />}
              <span>{m.sender === 'tutor' ? 'Alistair' : 'Tú'}</span>
              <span className="msg-time">{m.timestamp}</span>
              {m.latencyMs && (
                <span className="msg-latency-pill">
                  Turn-to-Ear: {m.latencyMs}ms
                </span>
              )}
            </div>

            <div className={`message-bubble ${m.sender}`}>
              <p className="message-text">{m.text}</p>

              {m.phoneticNotes && m.phoneticNotes.length > 0 && (
                <div className="phonetic-feedback-tray">
                  <Sparkles size={12} className="tray-icon" />
                  <span className="tray-label">Diagnóstico Fonético:</span>
                  <div className="phonetic-tags">
                    {m.phoneticNotes.map((note, idx) => (
                      <span key={idx} className="phonetic-feedback-tag">
                        {note}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isSimulating && (
          <div className="message-bubble-wrapper tutor thinking-placeholder">
            <div className="thinking-dots">
              <span />
              <span />
              <span />
            </div>
            <span className="thinking-label">LLM TTFT + Síntesis TTS en streaming...</span>
          </div>
        )}
      </div>

      <div className="conv-quick-replies">
        <span className="quick-label">Simular respuesta hablada del alumno:</span>
        <div className="quick-buttons-row">
          {samplePrompts.map((p, i) => (
            <button
              key={i}
              className="quick-prompt-btn"
              onClick={() => onUserSpeakSample(p.text)}
              disabled={isSimulating}
            >
              <Volume2 size={13} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
