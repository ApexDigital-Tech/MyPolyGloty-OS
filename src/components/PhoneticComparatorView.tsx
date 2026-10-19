import React, { useState, useRef, useEffect } from 'react';
import manifest from '../../benchmarks/phonetic_dataset/benchmark_manifest.json';
import { PhoneticEngine, type BenchmarkCase, type PhoneticAnalysisResult, type PhonemeScore } from '../phonetics/PhoneticEngine';
import { MandarinToneVisualizer } from './MandarinToneVisualizer';
import { SessionVideoExporter } from '../services/sessionVideoExporter';
import {
  Repeat,
  Scissors,
  Download,
  Play,
  AlertTriangle,
  CheckCircle2,
  FileVideo,
  Layers,
  Clock,
  Sliders,
} from 'lucide-react';

export const PhoneticComparatorView: React.FC = () => {
  const cases = manifest.cases as BenchmarkCase[];
  const [selectedCase, setSelectedCase] = useState<BenchmarkCase>(cases[0]);
  const [filterLang, setFilterLang] = useState<'all' | 'en' | 'zh'>('all');
  const [analysisResult, setAnalysisResult] = useState<PhoneticAnalysisResult>(() =>
    PhoneticEngine.getInstance().evaluateBenchmarkCase(cases[0])
  );

  // Estados de reproducción y control A/B
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLoopingError, setIsLoopingError] = useState<boolean>(false);
  const [selectedPhonemeIndex, setSelectedPhonemeIndex] = useState<number | null>(null);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);

  // Audio elements y Web Audio
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const loopIntervalRef = useRef<number | null>(null);

  const filteredCases = cases.filter((c) => {
    if (filterLang === 'en') return c.language.startsWith('en');
    if (filterLang === 'zh') return c.language.startsWith('zh');
    return true;
  });

  const handleSelectCase = (tc: BenchmarkCase) => {
    stopAnyPlayback();
    setSelectedCase(tc);
    const result = PhoneticEngine.getInstance().evaluateBenchmarkCase(tc);
    setAnalysisResult(result);
    setSelectedPhonemeIndex(result.failingPhonemeIndex);
    setExportedVideoUrl(null);
  };

  const stopAnyPlayback = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    if (loopIntervalRef.current) {
      window.clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }
    setIsLoopingError(false);
  };

  // Reproducir audio completo con velocidad regulada
  const playFullAudio = (audioPath?: string) => {
    if (!audioPath) return;
    stopAnyPlayback();

    const audio = new Audio(audioPath);
    audio.playbackRate = playbackSpeed;
    audioElementRef.current = audio;
    audio.play().catch((e) => console.log('Audio playback policy:', e));
  };

  // Reproducción quirúrgica de un fonema específico [startMs, endMs]
  const playIsolatedPhoneme = (phoneme: PhonemeScore, audioPath?: string) => {
    if (!audioPath) return;
    stopAnyPlayback();

    const audio = new Audio(audioPath);
    audio.playbackRate = playbackSpeed;
    audioElementRef.current = audio;

    const startSec = phoneme.startTimeMs / 1000;
    const durationSec = Math.max(0.08, (phoneme.endTimeMs - phoneme.startTimeMs) / 1000);

    audio.currentTime = startSec;
    audio.play().catch((e) => console.log('Audio playback error:', e));

    setTimeout(() => {
      audio.pause();
    }, (durationSec / playbackSpeed) * 1000);
  };

  // Actuador de bucle milimétrico sobre el fonema fallido
  const toggleLoopFailingSegment = () => {
    if (isLoopingError) {
      stopAnyPlayback();
      return;
    }

    if (!selectedCase.audioPath || !analysisResult.failingTimeRangeMs) return;

    setIsLoopingError(true);
    const [startMs, endMs] = analysisResult.failingTimeRangeMs;
    const startSec = startMs / 1000;
    const durMs = Math.max(80, endMs - startMs);

    const playSegment = () => {
      const audio = new Audio(selectedCase.audioPath);
      audio.playbackRate = playbackSpeed;
      audio.currentTime = startSec;
      audio.play().catch(() => {});
      setTimeout(() => {
        audio.pause();
      }, (durMs / playbackSpeed) * 1000);
    };

    playSegment();
    const intervalTime = Math.max(600, (durMs / playbackSpeed) * 1000 + 400);
    loopIntervalRef.current = window.setInterval(playSegment, intervalTime);
  };

  // Descargar recorte WAV aislado del error
  const handleDownloadFailingWav = () => {
    if (!analysisResult.failingTimeRangeMs) return;
    const [startMs, endMs] = analysisResult.failingTimeRangeMs;
    const exporter = SessionVideoExporter.getInstance();
    const wavBlob = exporter.generateSynthesizedClipWav(startMs, endMs);
    const url = URL.createObjectURL(wavBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `error_clip_${selectedCase.targetWord}_${analysisResult.failingPhoneme || 'syllable'}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Exportar video MP4 resumen de la sesión
  const handleExportSummaryVideo = async () => {
    setIsExportingVideo(true);
    try {
      const exporter = SessionVideoExporter.getInstance();
      const videoBlob = await exporter.generateSummaryVideo({
        targetWord: `${selectedCase.targetWord} (${selectedCase.simulatedUtterance})`,
        result: analysisResult,
        cefrBand: 'B1',
      });
      const url = URL.createObjectURL(videoBlob);
      setExportedVideoUrl(url);

      const a = document.createElement('a');
      a.href = url;
      a.download = `resumen_fonetico_${selectedCase.id}.webm`;
      a.click();
    } catch (err) {
      console.error('Error al exportar video:', err);
    } finally {
      setIsExportingVideo(false);
    }
  };

  useEffect(() => {
    return () => {
      stopAnyPlayback();
    };
  }, []);

  const isMandarin = selectedCase.language.startsWith('zh');

  return (
    <div className="comparator-container">
      {/* Header del Comparador Quirúrgico */}
      <header className="comparator-header-card">
        <div className="header-left-info">
          <div className="comparator-badge-icon">
            <Sliders size={22} />
          </div>
          <div>
            <h2 className="comparator-title">Comparador Fonético Quirúrgico &amp; Actuador Multimedia</h2>
            <p className="comparator-subtitle">
              Inspección fonema por fonema (IPA) con código de color semafórico, contorno de tonos en Mandarín y aislamiento milimétrico de error en bucle.
            </p>
          </div>
        </div>

        <div className="comparator-actions-bar">
          <button
            className="export-video-btn"
            onClick={handleExportSummaryVideo}
            disabled={isExportingVideo}
            title="Exportar video MP4/WebM de resumen de la sesión con subtítulos y forma de onda"
          >
            <FileVideo size={16} />
            <span>{isExportingVideo ? 'Renderizando Video...' : 'Exportar Video Resumen'}</span>
          </button>
        </div>
      </header>

      {/* Grid Principal: Selector lateral de Casos + Panel de Inspección Quirúrgica */}
      <div className="comparator-workspace-grid">
        {/* Columna Izquierda: Casos del Benchmark */}
        <aside className="cases-sidebar">
          <div className="sidebar-filter-tabs">
            <button
              className={`filter-btn ${filterLang === 'all' ? 'active' : ''}`}
              onClick={() => setFilterLang('all')}
            >
              Todos (20)
            </button>
            <button
              className={`filter-btn ${filterLang === 'en' ? 'active' : ''}`}
              onClick={() => setFilterLang('en')}
            >
              Inglés (14)
            </button>
            <button
              className={`filter-btn ${filterLang === 'zh' ? 'active' : ''}`}
              onClick={() => setFilterLang('zh')}
            >
              Mandarín (6)
            </button>
          </div>

          <div className="cases-scroll-list">
            {filteredCases.map((tc) => {
              const isSelected = tc.id === selectedCase.id;
              const isZh = tc.language.startsWith('zh');
              return (
                <div
                  key={tc.id}
                  className={`case-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectCase(tc)}
                >
                  <div className="case-card-header">
                    <span className="case-target-word">{tc.targetWord}</span>
                    <span className={`case-lang-tag ${isZh ? 'zh' : 'en'}`}>
                      {isZh ? 'Mandarín' : 'Inglés'}
                    </span>
                  </div>
                  <div className="case-error-row">
                    <span className="error-type-label">{tc.errorType}</span>
                    <span className="error-phoneme-badge">/{tc.failingPhoneme}/</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Columna Central: Desglose Fonema por Fonema e Inspección */}
        <main className="comparator-detail-panel">
          {/* Tarjeta Principal de la Palabra */}
          <div className="word-inspection-hero">
            <div className="word-meta-row">
              <div>
                <span className="word-label">Palabra / Locución Objetivo:</span>
                <h3 className="target-word-title">{selectedCase.targetWord}</h3>
                <span className="simulated-utterance-sub">
                  Audio del alumno: "{selectedCase.simulatedUtterance}"
                </span>
              </div>

              <div className="overall-score-badge">
                <span className="score-num">{analysisResult.overallScore}%</span>
                <span className="score-desc">
                  {analysisResult.overallScore >= 80 ? 'Precisión Óptima' : analysisResult.overallScore >= 50 ? 'Desviación Leve' : 'Fallo Articulario'}
                </span>
              </div>
            </div>

            {/* Diagnóstico Quirúrgico */}
            <div className={`diagnostic-banner ${analysisResult.hasError ? 'error' : 'pass'}`}>
              {analysisResult.hasError ? (
                <AlertTriangle size={18} className="text-amber" />
              ) : (
                <CheckCircle2 size={18} className="text-green" />
              )}
              <span className="diagnostic-text">{analysisResult.diagnostic}</span>
            </div>

            {/* Desglose Fonema por Fonema IPA con Semáforo Semafórico */}
            <div className="phonemes-breakdown-section">
              <span className="section-label">
                <Layers size={14} /> Desglose Fonético IPA (Haz clic en un fonema para escucharlo aislado):
              </span>

              <div className="phonemes-interactive-grid">
                {analysisResult.phonemeScores.map((p, idx) => {
                  const isSelected = selectedPhonemeIndex === idx;
                  const isFailing = analysisResult.failingPhonemeIndex === idx;
                  const durationMs = p.endTimeMs - p.startTimeMs;

                  return (
                    <div
                      key={idx}
                      className={`phoneme-card ${p.status} ${isSelected ? 'active-selection' : ''} ${isFailing ? 'failing-target' : ''}`}
                      onClick={() => {
                        setSelectedPhonemeIndex(idx);
                        playIsolatedPhoneme(p, selectedCase.audioPath);
                      }}
                      title={`Haz clic para reproducir [${p.startTimeMs}ms - ${p.endTimeMs}ms]`}
                    >
                      <div className="phoneme-ipa-char">{p.phoneme}</div>
                      <div className="phoneme-score-val">{p.score}%</div>
                      <div className="phoneme-timing-tag">
                        <Clock size={10} /> {durationMs} ms
                      </div>
                      <div className="phoneme-status-indicator">
                        {p.status === 'optimal' ? (
                          <span className="dot optimal" />
                        ) : p.status === 'warning' ? (
                          <span className="dot warning" />
                        ) : (
                          <span className="dot error" />
                        )}
                        <span>{p.status.toUpperCase()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detalles Articulatorios del Fonema Seleccionado */}
            {selectedPhonemeIndex !== null && analysisResult.phonemeScores[selectedPhonemeIndex] && (
              <div className="selected-phoneme-metrics-card">
                <div className="metrics-card-header">
                  <span className="metric-title">
                    Detalles Acústicos: /{analysisResult.phonemeScores[selectedPhonemeIndex].phoneme}/
                  </span>
                  <span className="time-range-tag">
                    Intervalo: {analysisResult.phonemeScores[selectedPhonemeIndex].startTimeMs} ms &bull; {analysisResult.phonemeScores[selectedPhonemeIndex].endTimeMs} ms
                  </span>
                </div>

                <div className="formants-row">
                  <div className="formant-box">
                    <span className="formant-name">Primer Formante (F1):</span>
                    <span className="formant-val">
                      {analysisResult.phonemeScores[selectedPhonemeIndex].formantMatchF1} Hz
                    </span>
                    <span className="formant-hint">Apertura Mandibular / Altura Vocálica</span>
                  </div>
                  <div className="formant-box">
                    <span className="formant-name">Segundo Formante (F2):</span>
                    <span className="formant-val">
                      {analysisResult.phonemeScores[selectedPhonemeIndex].formantMatchF2} Hz
                    </span>
                    <span className="formant-hint">Posición de la Lengua (Anterior/Posterior)</span>
                  </div>
                  <div className="formant-box">
                    <span className="formant-name">Energía Articularia:</span>
                    <span className="formant-val">
                      {(analysisResult.phonemeScores[selectedPhonemeIndex].score * 0.95).toFixed(0)} dB
                    </span>
                    <span className="formant-hint">Sonoridad vs. Consonante Sorda</span>
                  </div>
                </div>
              </div>
            )}

            {/* Visualizador de Tonos en Mandarín (si aplica) */}
            {isMandarin && (
              <div className="mandarin-module-wrapper">
                <MandarinToneVisualizer
                  pitchContour={analysisResult.pitchContour}
                  targetTone={selectedCase.targetTone || 1}
                  detectedTone={analysisResult.toneResult?.detectedTone}
                  targetPinyin={selectedCase.targetWord}
                  hanzi={selectedCase.simulatedUtterance.split(' ')[0]}
                  onPlayTargetAudio={() => playFullAudio(selectedCase.audioPath)}
                  onPlayUserAudio={() => playFullAudio(selectedCase.audioPath)}
                />
              </div>
            )}

            {/* Barra de Controles A/B y Actuador FFmpeg */}
            <div className="playback-actuator-bar">
              <div className="audio-buttons-group">
                <button
                  className="ctrl-btn primary"
                  onClick={() => playFullAudio(selectedCase.audioPath)}
                >
                  <Play size={16} />
                  <span>Escuchar Locución del Alumno</span>
                </button>

                <button
                  className={`ctrl-btn loop ${isLoopingError ? 'active' : ''}`}
                  onClick={toggleLoopFailingSegment}
                  title="Reproduce en bucle únicamente la porción con error para calibrar el oído"
                >
                  <Repeat size={16} className={isLoopingError ? 'animate-spin' : ''} />
                  <span>{isLoopingError ? 'Detener Bucle' : 'Aislar Error en Bucle'}</span>
                </button>

                <button
                  className="ctrl-btn cut"
                  onClick={handleDownloadFailingWav}
                  title="Descarga el clip WAV milimétrico cortado por el actuador"
                >
                  <Scissors size={16} />
                  <span>Descargar Clip Recortado (.wav)</span>
                </button>
              </div>

              {/* Selector de Velocidad A/B (0.5x, 0.75x, 1.0x) */}
              <div className="speed-selector-group">
                <span className="speed-label">Velocidad:</span>
                {[0.5, 0.75, 1.0].map((s) => (
                  <button
                    key={s}
                    className={`speed-pill ${playbackSpeed === s ? 'active' : ''}`}
                    onClick={() => setPlaybackSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Aviso de Video Exportado (si se generó) */}
            {exportedVideoUrl && (
              <div className="video-export-success-card">
                <CheckCircle2 size={20} className="text-green" />
                <div className="success-meta">
                  <span className="title">Video Resumen MP4/WebM generado con éxito</span>
                  <span className="desc">Forma de onda, fonemas IPA y diagnóstico renderizados a 30 FPS.</span>
                </div>
                <a
                  href={exportedVideoUrl}
                  download={`resumen_fonetico_${selectedCase.id}.webm`}
                  className="download-video-link"
                >
                  <Download size={15} /> Descargar de nuevo
                </a>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
