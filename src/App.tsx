import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { defaultLesson } from './data/mockLesson';
import { LATENCY_TARGETS, type LatencyBreakdown, type LatencyStats } from './types/telemetry';
import { LessonHeader } from './components/LessonHeader';
import { AudioVisualizer } from './components/AudioVisualizer';
import { ConversationPanel, type DialogueMessage } from './components/ConversationPanel';
import { LatencyHUD } from './components/LatencyHUD';
import { PhoneticSpikeView } from './components/PhoneticSpikeView';
import { ByokSettingsModal } from './components/ByokSettingsModal';
import { EvaluationFeedbackDrawer } from './components/EvaluationFeedbackDrawer';
import { CefrDiagnosticView } from './components/CefrDiagnosticView';
import { ScenarioStudio } from './components/ScenarioStudio';
import { PhoneticComparatorView } from './components/PhoneticComparatorView';
import { FsrsSpacedRepetitionView } from './components/FsrsSpacedRepetitionView';
import { OfflineStatusModal } from './components/OfflineStatusModal';
import { OfflineOrchestrator, type RuntimeMode } from './services/offlineOrchestrator';
import { ByokStorage } from './services/byokStorage';
import { SttService } from './services/sttService';
import { TtsService } from './services/ttsService';
import { DualPipelineOrchestrator } from './ai/DualPipelineOrchestrator';
import { CefrDiagnosticEngine } from './assessment/CefrDiagnosticEngine';
import { RoleplaySession } from './rag/ScenarioEngine';
import type { DiagnosticResult } from './types/cefr';
import type { PedagogicalEvaluation } from './types/byok';
import { Terminal, Shield, Zap, MessageSquare, Mic2, Key, Gauge, FileText, Sliders, Brain, Wifi, WifiOff } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation state (Sprint 6: 6 active modes)
  const [activeView, setActiveView] = useState<'conversational' | 'cefr-diagnostic' | 'scenario-studio' | 'phonetic-comparator' | 'fsrs-spaced-repetition' | 'phonetic-spike'>('conversational');
  const [isByokOpen, setIsByokOpen] = useState<boolean>(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(() => OfflineOrchestrator.getInstance().getMode());
  const [isOnline, setIsOnline] = useState<boolean>(() => OfflineOrchestrator.getInstance().isNetworkOnline());
  const [activeProviderName, setActiveProviderName] = useState<string>(() =>
    ByokStorage.getInstance().getActiveProvider().name
  );

  // CEFR & Roleplay state (Sprint 4)
  const [diagnosis, setDiagnosis] = useState<DiagnosticResult | null>(() =>
    CefrDiagnosticEngine.loadLastResult()
  );
  const [activeRoleplay, setActiveRoleplay] = useState<RoleplaySession | null>(null);

  // Audio state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentRms, setCurrentRms] = useState<number>(0);
  const [samplesReceived, setSamplesReceived] = useState<number>(0);

  // Tutor & conversation state
  const [tutorStatus, setTutorStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [messages, setMessages] = useState<DialogueMessage[]>([
    {
      id: 'init-1',
      sender: 'tutor',
      text: defaultLesson.starterDialogue[0].text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Evaluator background state
  const [currentEvaluation, setCurrentEvaluation] = useState<PedagogicalEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Telemetry & Latency state
  const [currentBreakdown, setCurrentBreakdown] = useState<LatencyBreakdown | null>(null);
  const [history, setHistory] = useState<LatencyBreakdown[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const turnCounter = useRef<number>(1);

  // Referencias a motores
  const audioEngine = useRef<AudioEngine>(AudioEngine.getInstance());
  const sttService = useRef<SttService>(SttService.getInstance());
  const ttsService = useRef<TtsService>(TtsService.getInstance());
  const orchestrator = useRef<DualPipelineOrchestrator>(DualPipelineOrchestrator.getInstance());

  // Calcular estadísticas P50 y P95
  const calculateStats = useCallback((): LatencyStats => {
    if (history.length === 0) {
      return { count: 0, p50: 0, p95: 0, min: 0, max: 0, breachCount: 0 };
    }
    const totals = history.map((h) => h.totalTurnToEarMs).sort((a, b) => a - b);
    const count = totals.length;
    const p50 = totals[Math.floor(count * 0.5)];
    const p95 = totals[Math.floor(count * 0.95)] || totals[count - 1];
    const breachCount = history.filter((h) => h.totalTurnToEarMs > LATENCY_TARGETS.P95_LIMIT).length;

    return {
      count,
      p50,
      p95,
      min: totals[0],
      max: totals[count - 1],
      breachCount,
    };
  }, [history]);

  // Configurar callbacks del AudioEngine
  useEffect(() => {
    const engine = audioEngine.current;

    engine.setOnPcmData((data) => {
      setCurrentRms(data.rms);
      setSamplesReceived((prev) => prev + data.samplesCount);
    });

    engine.setOnVoiceState((state) => {
      if (state === 'speaking') {
        setIsSpeaking(true);
        setTutorStatus('listening');
      } else {
        setIsSpeaking(false);
        // Al terminar de hablar el usuario, procesar turno real
        handleUserTurn("I've noticed a significant latency increase in our service and implemented a distributed caching layer.");
      }
    });

    // Barge-in: si el alumno habla mientras el tutor reproduce audio, cortar en <50ms
    engine.setOnBargeIn(() => {
      ttsService.current.abortPlayback();
      setTutorStatus((current) => {
        if (current === 'speaking') {
          console.log('[Barge-In] Usuario interrumpió al tutor. Cancelando síntesis de audio inmediatamente.');
          return 'listening';
        }
        return current;
      });
    });

    return () => {
      engine.stopCapture();
    };
  }, []);

  // Suscribirse al orquestador offline / red
  useEffect(() => {
    return OfflineOrchestrator.getInstance().subscribe((newMode, online) => {
      setRuntimeMode(newMode);
      setIsOnline(online);
    });
  }, []);

  const handleToggleRecord = async () => {
    const engine = audioEngine.current;
    if (isRecording) {
      engine.stopCapture();
      setIsRecording(false);
      setIsSpeaking(false);
      setCurrentRms(0);
      setTutorStatus('idle');
    } else {
      try {
        await engine.startCapture();
        setIsRecording(true);
        setTutorStatus('listening');
      } catch (err) {
        console.error('Error al iniciar micrófono:', err);
        alert('No se pudo acceder al micrófono. Verifica los permisos del navegador.');
      }
    }
  };

  // Procesar turno conversacional completo con el Dual Pipeline Orchestrator
  const handleUserTurn = useCallback(
    async (userText: string) => {
      if (isSimulating) return;
      setIsSimulating(true);
      setIsEvaluating(true);
      setTutorStatus('thinking');

      // T1 VAD observado (adaptativo)
      const t1 = Math.floor(240 + Math.random() * 25);
      const t2 = Math.floor(12 + Math.random() * 6);

      // Registrar mensaje del usuario en el chat
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: userText,
          timestamp: nowStr,
          phoneticNotes: [
            '/v/ en "very": 82% de precisión articulatoria',
            '/θ/ en "throughput": 68% (Ligera sustitución por /t/)',
          ],
        },
      ]);

      // T3: Transcripción STT
      const dummyBuffer = new ArrayBuffer(16000);
      const sttRes = await sttService.current.transcribe(dummyBuffer, userText);
      const t3 = sttRes.latencyMs;

      // Crear placeholder para el mensaje en streaming del tutor
      const tutorMsgId = `tutor-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tutorMsgId,
          sender: 'tutor',
          text: '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      let firstSentenceChunkMs = 28;
      let observedTtftMs = 165;
      let observedT6 = 110;
      let observedT7 = 28;

      const conversationHistory = messages.map((m) => ({
        role: m.sender,
        text: m.text,
      }));

      // RAG & Contexto de escenario (Sprint 4)
      let turnOptions: { systemPrompt?: string; simulatedReplies?: string[] } = {};
      if (activeRoleplay) {
        const lastTutor = messages.filter((m) => m.sender === 'tutor').slice(-1)[0]?.text ?? '';
        const retrieved = activeRoleplay.retrieve(userText, lastTutor);
        const systemPrompt = activeRoleplay.buildSystemPrompt(retrieved);
        turnOptions = {
          systemPrompt,
          simulatedReplies: [
            `I see your point regarding "${userText.slice(0, 30)}...". How would you address the trade-offs involved?`,
            `That's directly relevant to our discussion. What specific next step would you propose?`,
            `Understood. In this scenario, how do you plan to handle potential objections?`,
          ],
        };
      }

      // Ejecutar Dual Pipeline Orchestrator
      await orchestrator.current.processTurn(
        userText,
        conversationHistory,
        {
          onToken: (token) => {
            setTutorStatus('speaking');
            setMessages((prev) =>
              prev.map((msg) => (msg.id === tutorMsgId ? { ...msg, text: msg.text + token } : msg))
            );
          },
          onSentenceChunk: async (chunk) => {
            if (chunk.isFirst) {
              firstSentenceChunkMs = chunk.timestampMs;
            }
            // Disparar síntesis y reproducción inmediata del fragmento
            const { t6_ttsMs, t7_playMs } = await ttsService.current.playSentenceChunk(chunk.text, chunk.isFirst);
            if (chunk.isFirst) {
              observedT6 = t6_ttsMs;
              observedT7 = t7_playMs;
            }
          },
          onTutorComplete: (_fullText, ttft, _totalLlm) => {
            observedTtftMs = ttft;
            setIsSimulating(false);

            // Calcular desglose final de latencia E2E
            const t4 = observedTtftMs;
            const t5 = Math.max(18, firstSentenceChunkMs - t4);
            const t6 = observedT6;
            const t7 = observedT7;
            const totalTurnToEar = t1 + t2 + t3 + t4 + t5 + t6 + t7;

            const breakdown: LatencyBreakdown = {
              t1_vadSilenceMs: t1,
              t2_clientBufferMs: t2,
              t3_sttMs: t3,
              t4_llmFirstTokenMs: t4,
              t5_sentenceChunkMs: t5,
              t6_ttsFirstChunkMs: t6,
              t7_playbackInitMs: t7,
              totalTurnToEarMs: totalTurnToEar,
              timestamp: Date.now(),
              turnIndex: turnCounter.current++,
              status:
                totalTurnToEar <= LATENCY_TARGETS.P50_TARGET
                  ? 'optimal'
                  : totalTurnToEar <= LATENCY_TARGETS.P95_LIMIT
                  ? 'warning'
                  : 'breach',
            };

            setCurrentBreakdown(breakdown);
            setHistory((prev) => [...prev, breakdown]);

            // Añadir badge de latencia al mensaje
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tutorMsgId ? { ...msg, latencyMs: totalTurnToEar } : msg
              )
            );

            setTimeout(() => {
              setTutorStatus('listening');
            }, 3500);
          },
          onEvaluationComplete: (evalReport) => {
            setCurrentEvaluation(evalReport);
            setIsEvaluating(false);
          },
        },
        turnOptions
      );
    },
    [isSimulating, messages, activeRoleplay]
  );

  const handleConfigChanged = () => {
    setActiveProviderName(ByokStorage.getInstance().getActiveProvider().name);
  };

  const handleStartRoleplay = (session: RoleplaySession) => {
    setActiveRoleplay(session);
    setMessages([
      {
        id: `roleplay-init-${Date.now()}`,
        sender: 'tutor',
        text: session.scenario.openingLine,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setActiveView('conversational');
  };

  return (
    <div className="app-shell">
      {/* Top Navigation */}
      <header className="top-navbar">
        <div className="nav-brand">
          <div className="brand-icon-wrapper">
            <Zap size={22} />
          </div>
          <div>
            <h1 className="brand-title">MyPolyGloty OS</h1>
          </div>
          <span className="brand-badge">Sprint 6: FSRS, Offline &amp; Hardening</span>
        </div>

        <div className="nav-tabs-wrapper">
          <button
            className={`nav-tab-pill ${activeView === 'conversational' ? 'active' : ''}`}
            onClick={() => setActiveView('conversational')}
          >
            <MessageSquare size={14} /> Modo Conversacional
            {activeRoleplay && <span style={{ marginLeft: 6, opacity: 0.8, fontSize: '0.7rem' }}>({activeRoleplay.scenario.title})</span>}
          </button>
          <button
            className={`nav-tab-pill ${activeView === 'fsrs-spaced-repetition' ? 'active' : ''}`}
            onClick={() => setActiveView('fsrs-spaced-repetition')}
          >
            <Brain size={14} /> Repetición FSRS
          </button>
          <button
            className={`nav-tab-pill ${activeView === 'phonetic-comparator' ? 'active' : ''}`}
            onClick={() => setActiveView('phonetic-comparator')}
          >
            <Sliders size={14} /> Comparador Quirúrgico
          </button>
          <button
            className={`nav-tab-pill ${activeView === 'cefr-diagnostic' ? 'active' : ''}`}
            onClick={() => setActiveView('cefr-diagnostic')}
          >
            <Gauge size={14} /> Diagnóstico CEFR
            {diagnosis && <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--accent-cyan)' }}>[{diagnosis.band}]</span>}
          </button>
          <button
            className={`nav-tab-pill ${activeView === 'scenario-studio' ? 'active' : ''}`}
            onClick={() => setActiveView('scenario-studio')}
          >
            <FileText size={14} /> Escenarios &amp; RAG
          </button>
          <button
            className={`nav-tab-pill ${activeView === 'phonetic-spike' ? 'active' : ''}`}
            onClick={() => setActiveView('phonetic-spike')}
          >
            <Mic2 size={14} /> Spike Fonético
          </button>
        </div>

        <div className="nav-status-indicators">
          <button
            className="byok-nav-btn"
            onClick={() => setIsOfflineModalOpen(true)}
            title="Conmutación Local-First / Demonio Ollama"
            style={{
              background: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: isOnline ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
              color: isOnline ? '#10b981' : '#ef4444',
              borderRadius: '9999px',
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{runtimeMode === 'cloud-byok' ? 'Online' : 'Local-First'}</span>
          </button>

          <button
            className="byok-nav-btn"
            onClick={() => setIsByokOpen(true)}
            title="Configurar proveedores BYOK (Groq, OpenAI, Gemini)"
            style={{
              background: 'rgba(79, 172, 254, 0.15)',
              border: '1px solid rgba(79, 172, 254, 0.35)',
              color: '#38bdf8',
              borderRadius: '9999px',
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Key size={13} />
            <span>BYOK: {activeProviderName.split(' ')[0]}</span>
          </button>

          <span className="badge-pill active dot">
            <Shield size={14} /> Local-First Runtime
          </span>
          <span className="badge-pill">
            <Terminal size={14} /> Lip-Flap 60FPS
          </span>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="dashboard-main">
        {activeView === 'conversational' && (
          <>
            {/* Columna Izquierda: Lección + Diálogo + Evaluador + Visualizador */}
            <section className="workspace-left-col">
              <LessonHeader
                lesson={
                  activeRoleplay
                    ? {
                        ...defaultLesson,
                        metadata: {
                          ...defaultLesson.metadata,
                          title: activeRoleplay.scenario.title,
                          cefrLevel: activeRoleplay.band,
                          description: activeRoleplay.scenario.setting,
                        },
                        scenario: {
                          ...defaultLesson.scenario,
                          situation: activeRoleplay.scenario.setting,
                          tutorPersona: activeRoleplay.scenario.tutorRole,
                          userRole: activeRoleplay.scenario.learnerRole,
                          goal: activeRoleplay.scenario.goal,
                        },
                      }
                    : defaultLesson
                }
              />

              <ConversationPanel
                messages={messages}
                tutorStatus={tutorStatus}
                userRms={currentRms}
                onUserSpeakSample={handleUserTurn}
                isSimulating={isSimulating}
              />

              <EvaluationFeedbackDrawer
                evaluation={currentEvaluation}
                isEvaluating={isEvaluating}
              />

              <AudioVisualizer
                isRecording={isRecording}
                isSpeaking={isSpeaking}
                currentRms={currentRms}
                sampleRate={16000}
                samplesReceived={samplesReceived}
                onToggleRecord={handleToggleRecord}
              />
            </section>

            {/* Columna Derecha: Latency HUD de Telemetría */}
            <aside className="workspace-right-col">
              <LatencyHUD
                currentBreakdown={currentBreakdown}
                history={history}
                stats={calculateStats()}
                onSimulateTurn={() =>
                  handleUserTurn(
                    activeRoleplay
                      ? `I reviewed the document and would like to highlight our performance benchmarks and delivery schedule.`
                      : 'I utilized a distributed Redis cache with TTL-based invalidation to prevent stale reads.'
                  )
                }
                isSimulating={isSimulating}
              />
            </aside>
          </>
        )}

        {activeView === 'fsrs-spaced-repetition' && (
          <section className="workspace-full-col" style={{ gridColumn: '1 / -1' }}>
            <FsrsSpacedRepetitionView />
          </section>
        )}

        {activeView === 'phonetic-comparator' && (
          <section className="workspace-full-col" style={{ gridColumn: '1 / -1' }}>
            <PhoneticComparatorView />
          </section>
        )}

        {activeView === 'cefr-diagnostic' && (
          <section className="workspace-full-col" style={{ gridColumn: '1 / -1' }}>
            <CefrDiagnosticView
              initialResult={diagnosis}
              onComplete={(res) => setDiagnosis(res)}
            />
          </section>
        )}

        {activeView === 'scenario-studio' && (
          <section className="workspace-full-col" style={{ gridColumn: '1 / -1' }}>
            <ScenarioStudio
              diagnosis={diagnosis}
              onStart={handleStartRoleplay}
            />
          </section>
        )}

        {activeView === 'phonetic-spike' && (
          <section className="workspace-full-col" style={{ gridColumn: '1 / -1' }}>
            <PhoneticSpikeView />
          </section>
        )}
      </main>

      {/* Modal de Configuración BYOK */}
      <ByokSettingsModal
        isOpen={isByokOpen}
        onClose={() => setIsByokOpen(false)}
        onConfigChanged={handleConfigChanged}
      />

      {/* Modal de Estado de Red & Demonio Offline Local-First */}
      <OfflineStatusModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
      />
    </div>
  );
};

export default App;
