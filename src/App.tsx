import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LATENCY_TARGETS, type LatencyBreakdown, type LatencyStats } from './types/telemetry';
import { ConversationPanel, type DialogueMessage } from './components/ConversationPanel';
import { LatencyHUD } from './components/LatencyHUD';
import { PhoneticSpikeView } from './components/PhoneticSpikeView';
import { ByokSettingsModal } from './components/ByokSettingsModal';
import { CefrDiagnosticView } from './components/CefrDiagnosticView';
import { ScenarioStudio } from './components/ScenarioStudio';
import { PhoneticComparatorView } from './components/PhoneticComparatorView';
import { FsrsSpacedRepetitionView } from './components/FsrsSpacedRepetitionView';
import { OfflineStatusModal } from './components/OfflineStatusModal';
import { OfflineOrchestrator } from './services/offlineOrchestrator';
import { ByokStorage } from './services/byokStorage';
import { SttService } from './services/sttService';
import { TtsService } from './services/ttsService';
import { DualPipelineOrchestrator } from './ai/DualPipelineOrchestrator';
import { CefrDiagnosticEngine } from './assessment/CefrDiagnosticEngine';
import { RoleplaySession } from './rag/ScenarioEngine';
import type { DiagnosticResult } from './types/cefr';
import {
  TutorFacilitatorService,
  type LearningLevel,
  type TargetLanguage,
} from './services/tutorFacilitatorService';
import {
  MessageSquare,
  Sparkles,
  Award,
  BookOpen,
  Key,
  Activity,
  Sun,
  Moon,
  ChevronRight,
  Wifi,
  WifiOff,
  Flame,
  X,
  Volume2,
} from 'lucide-react';

export const App: React.FC = () => {
  // Tema Claro / Oscuro con persistencia
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('mypolygloty_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mypolygloty_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Navegación principal estilo Praktika
  const [activeView, setActiveView] = useState<
    'conversational' | 'cefr-diagnostic' | 'scenario-studio' | 'phonetic-comparator' | 'fsrs-spaced-repetition' | 'phonetic-spike'
  >('conversational');

  const [isByokOpen, setIsByokOpen] = useState<boolean>(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState<boolean>(false);

  const [isOnline, setIsOnline] = useState<boolean>(() => OfflineOrchestrator.getInstance().isNetworkOnline());
  const [activeProviderName, setActiveProviderName] = useState<string>(() =>
    ByokStorage.getInstance().getActiveProvider().name
  );

  // CEFR & Roleplay state
  const [diagnosis, setDiagnosis] = useState<DiagnosticResult | null>(() =>
    CefrDiagnosticEngine.loadLastResult()
  );
  const [activeRoleplay, setActiveRoleplay] = useState<RoleplaySession | null>(null);

  // Facilitador Pedagógico, Nivel e Idioma
  const facilitator = useRef(TutorFacilitatorService.getInstance());
  const [currentLevel, setCurrentLevel] = useState<LearningLevel>(() => facilitator.current.getLevel());
  const [currentLanguage, setCurrentLanguage] = useState<TargetLanguage>(() => facilitator.current.getLanguage());
  const [speechRate, setSpeechRate] = useState<number>(() =>
    facilitator.current.getRecommendedSpeechRate(facilitator.current.getLevel())
  );
  const [sessionStats, setSessionStats] = useState(() => {
    const r = facilitator.current.getActiveRoutine();
    return {
      turnsCompleted: 0,
      targetTurns: r.targetTurns,
      phaseName: facilitator.current.getCurrentPhaseName(),
      fluencyScore: 82,
      vocabScore: 80,
      grammarScore: 86,
    };
  });

  // Audio & Tutor state
  const [currentRms] = useState<number>(0);
  const [tutorStatus, setTutorStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [messages, setMessages] = useState<DialogueMessage[]>([
    {
      id: 'init-1',
      sender: 'tutor',
      text: "Hello! I am Alistair. What is your name?",
      translation: "¡Hola! Soy Alistair. ¿Cómo te llamas?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Telemetry & Latency state
  const [currentBreakdown, setCurrentBreakdown] = useState<LatencyBreakdown | null>(null);
  const [history, setHistory] = useState<LatencyBreakdown[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const turnCounter = useRef<number>(1);

  // Referencias a motores
  const sttService = useRef<SttService>(SttService.getInstance());
  const ttsService = useRef<TtsService>(TtsService.getInstance());
  const orchestrator = useRef<DualPipelineOrchestrator>(DualPipelineOrchestrator.getInstance());

  // Suscripción al orquestador offline / red
  useEffect(() => {
    return OfflineOrchestrator.getInstance().subscribe((_newMode, online) => {
      setIsOnline(online);
    });
  }, []);

  // Handlers para cambio de Nivel, Idioma y Rutina
  const handleLevelChange = (lvl: LearningLevel) => {
    setCurrentLevel(lvl);
    facilitator.current.setLevel(lvl);
    const recRate = facilitator.current.getRecommendedSpeechRate(lvl);
    setSpeechRate(recRate);
    const r = facilitator.current.getActiveRoutine();
    setSessionStats({
      turnsCompleted: 0,
      targetTurns: r.targetTurns,
      phaseName: facilitator.current.getCurrentPhaseName(),
      fluencyScore: 80,
      vocabScore: 78,
      grammarScore: 82,
    });
    setMessages([
      {
        id: `level-init-${Date.now()}`,
        sender: 'tutor',
        text: r.starterPrompt,
        translation: r.starterTranslation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleLanguageChange = (lang: TargetLanguage) => {
    setCurrentLanguage(lang);
    facilitator.current.setLanguage(lang);
    const r = facilitator.current.getActiveRoutine();
    setCurrentLevel(r.level);
    setSpeechRate(facilitator.current.getRecommendedSpeechRate(r.level));
    setSessionStats({
      turnsCompleted: 0,
      targetTurns: r.targetTurns,
      phaseName: facilitator.current.getCurrentPhaseName(),
      fluencyScore: 80,
      vocabScore: 78,
      grammarScore: 82,
    });
    setMessages([
      {
        id: `lang-init-${Date.now()}`,
        sender: 'tutor',
        text: r.starterPrompt,
        translation: r.starterTranslation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleRoutineSelect = (routineId: string) => {
    const r = facilitator.current.setRoutine(routineId);
    setCurrentLevel(r.level);
    setCurrentLanguage(r.language);
    setSpeechRate(facilitator.current.getRecommendedSpeechRate(r.level));
    setSessionStats({
      turnsCompleted: 0,
      targetTurns: r.targetTurns,
      phaseName: facilitator.current.getCurrentPhaseName(),
      fluencyScore: 82,
      vocabScore: 80,
      grammarScore: 85,
    });
    setMessages([
      {
        id: `routine-init-${Date.now()}`,
        sender: 'tutor',
        text: r.starterPrompt,
        translation: r.starterTranslation,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

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

  // Procesar turno conversacional (Texto o Voz)
  const handleUserTurn = useCallback(
    async (userText: string) => {
      if (isSimulating) return;
      setIsSimulating(true);
      setTutorStatus('thinking');

      const t1 = Math.floor(180 + Math.random() * 20);
      const t2 = Math.floor(10 + Math.random() * 5);

      // Generar respuesta pedagógica facilitada y traducción
      const facilitated = facilitator.current.generateFacilitatedResponse(userText);
      setSessionStats(facilitated.progress);

      const userTranslation = facilitator.current.getTranslation(userText);

      // Registrar mensaje del usuario en el chat con traducción
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: userText,
          translation: userTranslation,
          timestamp: nowStr,
          grammarCorrection: facilitated.grammarTip,
          phoneticNotes: [
            currentLanguage === 'zh'
              ? 'Tonalidad precisa en Pinyin'
              : '/v/ en palabras clave: 86% de articulación nativa',
            'Cadencia fluida',
          ],
        },
      ]);

      // T3: Transcripción
      const dummyBuffer = new ArrayBuffer(16000);
      const sttRes = await sttService.current.transcribe(dummyBuffer, userText);
      const t3 = sttRes.latencyMs;

      // Placeholder del tutor
      const tutorMsgId = `tutor-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tutorMsgId,
          sender: 'tutor',
          text: '',
          translation: '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      let firstSentenceChunkMs = 28;
      let observedTtftMs = 150;
      let observedT6 = 100;
      let observedT7 = 25;
      let accumulatedTutorText = '';

      const conversationHistory = messages.map((m) => ({
        role: m.sender,
        text: m.text,
      }));

      // RAG & Contexto de escenario o respuesta facilitada
      const systemPrompt = `You are an interactive, supportive language tutor facilitating learning in ${currentLanguage === 'zh' ? 'Chinese Mandarin' : 'English'} for a student at level ${currentLevel}. Speak concisely, validate what they said, and ask one natural question to help them advance.`;
      const turnOptions: { systemPrompt?: string; simulatedReplies?: string[] } = {
        systemPrompt,
        simulatedReplies: [facilitated.replyText],
      };

      // Ejecutar Dual Pipeline Orchestrator
      await orchestrator.current.processTurn(
        userText,
        conversationHistory,
        {
          onToken: (token) => {
            accumulatedTutorText += token;
            setTutorStatus('speaking');
            setMessages((prev) =>
              prev.map((msg) => (msg.id === tutorMsgId ? { ...msg, text: msg.text + token } : msg))
            );
          },
          onSentenceChunk: async (chunk) => {
            if (chunk.isFirst) {
              firstSentenceChunkMs = chunk.timestampMs;
            }
            const { t6_ttsMs, t7_playMs } = await ttsService.current.playSentenceChunk(chunk.text, chunk.isFirst);
            if (chunk.isFirst) {
              observedT6 = t6_ttsMs;
              observedT7 = t7_playMs;
            }
          },
          onTutorComplete: (_fullText, ttft) => {
            observedTtftMs = ttft;
            setIsSimulating(false);

            // Hablar respuesta con voz humana real del navegador con velocidad calibrada
            const voiceLang = currentLanguage === 'zh' ? 'zh-CN' : 'en-GB';
            ttsService.current.speakText(accumulatedTutorText, voiceLang, speechRate).catch(() => {});

            // Calcular desglose final de latencia
            const t4 = observedTtftMs;
            const t5 = Math.max(15, firstSentenceChunkMs - t4);
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

            // Asignar latencia y traducción final
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tutorMsgId
                  ? {
                      ...msg,
                      latencyMs: totalTurnToEar,
                      translation: facilitated.translationText,
                    }
                  : msg
              )
            );

            setTimeout(() => {
              setTutorStatus('idle');
            }, 3000);
          },
          onEvaluationComplete: (evaluation) => {
            console.log('[Pedagogical Evaluation]', evaluation);
          },
        },
        turnOptions
      );
    },
    [isSimulating, messages, currentLanguage, currentLevel]
  );

  const handleStartRoleplay = (roleplay: RoleplaySession) => {
    setActiveRoleplay(roleplay);
    setActiveView('conversational');
    setMessages([
      {
        id: `roleplay-init-${Date.now()}`,
        sender: 'tutor',
        text: roleplay.scenario.openingLine,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `reset-${Date.now()}`,
        sender: 'tutor',
        text: "Let's start fresh! What topic or interview scenario would you like to practice today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setTutorStatus('idle');
  };

  return (
    <div className="praktika-app-shell">
      {/* Barra de Navegación Superior Limpia & Profesional */}
      <header className="praktika-navbar">
        <div className="navbar-brand-section">
          <div className="brand-logo-badge">
            <Sparkles size={20} className="brand-icon" />
          </div>
          <div className="brand-names">
            <h1 className="brand-title">MyPolyGloty</h1>
            <span className="brand-subtitle">AI Language Tutor</span>
          </div>
        </div>

        {/* Pestañas de Navegación Desktop */}
        <nav className="navbar-desktop-nav" aria-label="Navegación principal">
          <button
            className={`nav-tab-btn ${activeView === 'conversational' ? 'active' : ''}`}
            onClick={() => setActiveView('conversational')}
          >
            <MessageSquare size={16} />
            <span>Tutor</span>
          </button>

          <button
            className={`nav-tab-btn ${activeView === 'fsrs-spaced-repetition' ? 'active' : ''}`}
            onClick={() => setActiveView('fsrs-spaced-repetition')}
          >
            <Flame size={16} />
            <span>Repetición FSRS</span>
          </button>

          <button
            className={`nav-tab-btn ${activeView === 'phonetic-comparator' ? 'active' : ''}`}
            onClick={() => setActiveView('phonetic-comparator')}
          >
            <Volume2 size={16} />
            <span>Pronunciación</span>
          </button>

          <button
            className={`nav-tab-btn ${activeView === 'cefr-diagnostic' ? 'active' : ''}`}
            onClick={() => setActiveView('cefr-diagnostic')}
          >
            <Award size={16} />
            <span>Nivel CEFR</span>
          </button>

          <button
            className={`nav-tab-btn ${activeView === 'scenario-studio' ? 'active' : ''}`}
            onClick={() => setActiveView('scenario-studio')}
          >
            <BookOpen size={16} />
            <span>Escenarios</span>
          </button>
        </nav>

        {/* Acciones de Cabecera: Modo Claro/Oscuro, Telemetría, BYOK */}
        <div className="navbar-actions-section">
          {/* Toggle Modo Claro / Oscuro */}
          <button
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            aria-label="Alternar tema claro y oscuro"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Botón Telemetría HUD (Opcional, no invasivo) */}
          <button
            className={`btn-telemetry-toggle ${showTelemetryDrawer ? 'active' : ''}`}
            onClick={() => setShowTelemetryDrawer((prev) => !prev)}
            title="Ver métricas de latencia Turn-to-Ear"
            aria-label="Alternar panel de telemetría"
          >
            <Activity size={16} />
            <span className="telemetry-label">Telemetría</span>
          </button>

          {/* Configuración BYOK */}
          <button
            className="btn-nav-action byok"
            onClick={() => setIsByokOpen(true)}
            title={`Proveedor activo: ${activeProviderName}`}
          >
            <Key size={16} />
            <span className="byok-name">{activeProviderName.split(' ')[0]}</span>
          </button>

          {/* Estado de Red */}
          <button
            className={`btn-network-pill ${isOnline ? 'online' : 'offline'}`}
            onClick={() => setIsOfflineModalOpen(true)}
            title={isOnline ? 'Conexión activa' : 'Modo Offline local'}
          >
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="praktika-main-content">
        {activeView === 'conversational' && (
          <div className="conversational-stage-layout">
            {/* Contexto de la Lección / Escenario Actual */}
            <div className="scenario-context-strip">
              <div className="scenario-pill-badge">
                <span className="level-badge">{diagnosis?.band || 'B1'}</span>
                <span className="scenario-name">
                  {activeRoleplay?.scenario.title || 'Senior Frontend Job Interview'}
                </span>
              </div>
              <button
                className="btn-change-scenario"
                onClick={() => setActiveView('scenario-studio')}
              >
                <span>Cambiar Escenario</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Chat Conversacional 100% Funcional estilo Praktika */}
            <ConversationPanel
              messages={messages}
              tutorStatus={tutorStatus}
              userRms={currentRms}
              onSendMessage={handleUserTurn}
              onClearHistory={handleClearHistory}
              isSimulating={isSimulating}
              scenarioTitle={activeRoleplay?.scenario.title || facilitator.current.getActiveRoutine().title}
              currentLevel={currentLevel}
              currentLanguage={currentLanguage}
              speechRate={speechRate}
              onLevelChange={handleLevelChange}
              onLanguageChange={handleLanguageChange}
              onSpeechRateChange={setSpeechRate}
              onRoutineSelect={handleRoutineSelect}
              sessionStats={sessionStats}
            />
          </div>
        )}

        {activeView === 'fsrs-spaced-repetition' && (
          <div className="subview-container">
            <FsrsSpacedRepetitionView />
          </div>
        )}

        {activeView === 'phonetic-comparator' && (
          <div className="subview-container">
            <PhoneticComparatorView />
          </div>
        )}

        {activeView === 'cefr-diagnostic' && (
          <div className="subview-container">
            <CefrDiagnosticView
              initialResult={diagnosis}
              onComplete={(res) => setDiagnosis(res)}
            />
          </div>
        )}

        {activeView === 'scenario-studio' && (
          <div className="subview-container">
            <ScenarioStudio diagnosis={diagnosis} onStart={handleStartRoleplay} />
          </div>
        )}

        {activeView === 'phonetic-spike' && (
          <div className="subview-container">
            <PhoneticSpikeView />
          </div>
        )}
      </main>

      {/* Drawer / Panel Deslizante de Telemetría (No bloquea la pantalla) */}
      {showTelemetryDrawer && (
        <aside className="telemetry-slide-drawer">
          <div className="telemetry-drawer-header">
            <div className="drawer-title-group">
              <Activity size={18} className="telemetry-icon" />
              <h3>Telemetría Turn-to-Ear</h3>
            </div>
            <button
              className="btn-close-drawer"
              onClick={() => setShowTelemetryDrawer(false)}
              aria-label="Cerrar telemetría"
            >
              <X size={18} />
            </button>
          </div>
          <div className="telemetry-drawer-body">
            <LatencyHUD
              currentBreakdown={currentBreakdown}
              history={history}
              stats={calculateStats()}
              onSimulateTurn={() =>
                handleUserTurn(
                  'I resolved the performance bottleneck by caching responses with a 5-minute TTL.'
                )
              }
              isSimulating={isSimulating}
            />
          </div>
        </aside>
      )}

      {/* Barra de Navegación Inferior para Móviles (100% Mobile Responsive) */}
      <nav className="praktika-mobile-bottom-nav" aria-label="Navegación móvil">
        <button
          className={`mobile-nav-item ${activeView === 'conversational' ? 'active' : ''}`}
          onClick={() => setActiveView('conversational')}
        >
          <MessageSquare size={20} />
          <span>Tutor</span>
        </button>

        <button
          className={`mobile-nav-item ${activeView === 'fsrs-spaced-repetition' ? 'active' : ''}`}
          onClick={() => setActiveView('fsrs-spaced-repetition')}
        >
          <Flame size={20} />
          <span>FSRS</span>
        </button>

        <button
          className={`mobile-nav-item ${activeView === 'phonetic-comparator' ? 'active' : ''}`}
          onClick={() => setActiveView('phonetic-comparator')}
        >
          <Volume2 size={20} />
          <span>Pronunciación</span>
        </button>

        <button
          className={`mobile-nav-item ${activeView === 'cefr-diagnostic' ? 'active' : ''}`}
          onClick={() => setActiveView('cefr-diagnostic')}
        >
          <Award size={20} />
          <span>CEFR</span>
        </button>

        <button
          className={`mobile-nav-item ${activeView === 'scenario-studio' ? 'active' : ''}`}
          onClick={() => setActiveView('scenario-studio')}
        >
          <BookOpen size={20} />
          <span>Escenarios</span>
        </button>
      </nav>

      {/* Modales de Configuración y Red */}
      <ByokSettingsModal
        isOpen={isByokOpen}
        onClose={() => setIsByokOpen(false)}
        onConfigChanged={() => {
          setActiveProviderName(ByokStorage.getInstance().getActiveProvider().name);
        }}
      />

      <OfflineStatusModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
      />
    </div>
  );
};

export default App;
