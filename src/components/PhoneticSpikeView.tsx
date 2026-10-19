import React, { useState } from 'react';
import manifest from '../../benchmarks/phonetic_dataset/benchmark_manifest.json';
import { PhoneticEngine, type BenchmarkCase, type PhoneticAnalysisResult } from '../phonetics/PhoneticEngine';
import { executePhoneticBenchmark, type BenchmarkMetrics } from '../phonetics/runBenchmark';
import { CheckCircle2, AlertTriangle, XCircle, Activity, Sparkles, Filter, Volume2, Globe } from 'lucide-react';

export const PhoneticSpikeView: React.FC = () => {
  const cases = manifest.cases as BenchmarkCase[];
  const [selectedCase, setSelectedCase] = useState<BenchmarkCase>(cases[0]);
  const [filterCategory, setFilterCategory] = useState<'all' | 'english' | 'mandarin'>('all');
  const [analysisResult, setAnalysisResult] = useState<PhoneticAnalysisResult>(() =>
    PhoneticEngine.getInstance().evaluateBenchmarkCase(cases[0])
  );
  const [benchmarkMetrics, setBenchmarkMetrics] = useState<BenchmarkMetrics | null>(null);
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);

  const filteredCases = cases.filter((c) => {
    if (filterCategory === 'english') return c.language.startsWith('en');
    if (filterCategory === 'mandarin') return c.language.startsWith('zh');
    return true;
  });

  const handleSelectCase = (tc: BenchmarkCase) => {
    setSelectedCase(tc);
    const result = PhoneticEngine.getInstance().evaluateBenchmarkCase(tc);
    setAnalysisResult(result);
  };

  const handleRunAllBenchmark = () => {
    setIsRunningAll(true);
    setTimeout(() => {
      const metrics = executePhoneticBenchmark();
      setBenchmarkMetrics(metrics);
      setIsRunningAll(false);
    }, 450);
  };

  const playAudio = (path?: string) => {
    if (!path) return;
    const audio = new Audio(path);
    audio.play().catch((err) => console.log('Audio playback error (browser user-gesture policy):', err));
  };

  return (
    <div className="phonetic-spike-container">
      {/* Top Banner de Validación del Spike */}
      <div className="spike-header-card">
        <div className="spike-title-group">
          <div className="spike-badge-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="spike-title">Spike Fonético Quirúrgico & Benchmark Ground Truth</h2>
            <p className="spike-subtitle">
              Validación científica del diferenciador clave: Alineación forzada fonema por fonema y análisis de tono F0 (Mandarín) sin depender de la normalización de Whisper.
            </p>
          </div>
        </div>

        <div className="spike-actions">
          <button
            className="run-benchmark-btn"
            onClick={handleRunAllBenchmark}
            disabled={isRunningAll}
          >
            <Activity size={16} />
            <span>{isRunningAll ? 'Ejecutando Suite...' : 'Validar Benchmark (20 Audios)'}</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Métricas Globales del Benchmark (si se ejecutó) */}
      {benchmarkMetrics && (
        <div className={`benchmark-results-banner ${benchmarkMetrics.passedThreshold ? 'passed' : 'failed'}`}>
          <div className="benchmark-result-status">
            {benchmarkMetrics.passedThreshold ? (
              <CheckCircle2 size={32} className="icon-pass" />
            ) : (
              <AlertTriangle size={32} className="icon-fail" />
            )}
            <div>
              <h3 className="result-title">
                {benchmarkMetrics.passedThreshold
                  ? 'SPIKE FONÉTICO VALIDADO (CRITERIO SUPERADO)'
                  : 'CRITERIO DE APROBACIÓN PENDIENTE'}
              </h3>
              <p className="result-desc">
                F1-Score: <strong>{benchmarkMetrics.f1Score}</strong> (Meta: &ge; 0.85) &bull; Error Temporal Medio: <strong>{benchmarkMetrics.meanTimeErrorMs} ms</strong> (Límite: &le; 50 ms)
              </p>
            </div>
          </div>

          <div className="metrics-badge-grid">
            <div className="metric-pill">
              <span className="pill-label">Casos Evaluados</span>
              <span className="pill-val">{benchmarkMetrics.totalCases} / 20</span>
            </div>
            <div className="metric-pill">
              <span className="pill-label">Precisión</span>
              <span className="pill-val">{(benchmarkMetrics.precision * 100).toFixed(1)}%</span>
            </div>
            <div className="metric-pill">
              <span className="pill-label">Sensibilidad (Recall)</span>
              <span className="pill-val">{(benchmarkMetrics.recall * 100).toFixed(1)}%</span>
            </div>
            <div className="metric-pill">
              <span className="pill-label">F1-Score</span>
              <span className="pill-val highlight">{benchmarkMetrics.f1Score}</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid Principal: Lista de Casos y Visualizador Fonético Detallado */}
      <div className="spike-main-grid">
        {/* Columna Izquierda: Selector de Casos de Prueba */}
        <div className="case-selector-card">
          <div className="selector-header">
            <div className="selector-title-row">
              <Filter size={14} />
              <span>Casos de Prueba Calibrados ({filteredCases.length})</span>
            </div>

            <div className="filter-pill-group">
              <button
                className={`filter-btn ${filterCategory === 'all' ? 'active' : ''}`}
                onClick={() => setFilterCategory('all')}
              >
                Todos (20)
              </button>
              <button
                className={`filter-btn ${filterCategory === 'english' ? 'active' : ''}`}
                onClick={() => setFilterCategory('english')}
              >
                Inglés (14)
              </button>
              <button
                className={`filter-btn ${filterCategory === 'mandarin' ? 'active' : ''}`}
                onClick={() => setFilterCategory('mandarin')}
              >
                Mandarín (6)
              </button>
            </div>
          </div>

          <div className="cases-list-scroll">
            {filteredCases.map((tc) => {
              const isSelected = tc.id === selectedCase.id;
              const isZh = tc.language.startsWith('zh');
              return (
                <div
                  key={tc.id}
                  className={`case-item-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectCase(tc)}
                >
                  <div className="case-meta">
                    <span className={`case-lang-tag ${isZh ? 'zh' : 'en'}`}>
                      {isZh ? 'zh-CN' : tc.language}
                    </span>
                    <span className="case-word-text">{tc.targetWord}</span>
                    <span className="case-error-pill">{tc.errorType}</span>
                  </div>
                  <div className="case-subtext">
                    Pronunciado: <em>"{tc.simulatedUtterance}"</em>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Análisis Quirúrgico del Caso Seleccionado */}
        <div className="case-analysis-card">
          <div className="analysis-card-header">
            <div>
              <span className="analysis-tag">Caso Seleccionado: {selectedCase.id}</span>
              <h3 className="target-word-heading">
                Palabra: <span className="highlight-word">{selectedCase.targetWord}</span>
              </h3>
            </div>

            {selectedCase.audioPath && (
              <button
                className="play-audio-btn"
                onClick={() => playAudio(selectedCase.audioPath)}
                title="Reproducir audio WAV 16kHz del benchmark"
              >
                <Volume2 size={16} />
                <span>Escuchar WAV 16kHz</span>
              </button>
            )}
          </div>

          {/* Diagnóstico Fonético del Motor */}
          <div className="diagnostic-alert-box">
            <div className="alert-badge">
              <Sparkles size={14} />
              <span>Diagnóstico Quirúrgico:</span>
            </div>
            <p className="diagnostic-text">{analysisResult.diagnostic}</p>
          </div>

          {/* Fonemas y Semáforo de Calidad */}
          <div className="phonemes-breakdown-section">
            <span className="section-label">Alineación Forzada Fonema por Fonema:</span>
            <div className="phoneme-cards-grid">
              {analysisResult.phonemeScores.map((ps, idx) => {
                const isFailing = idx === analysisResult.failingPhonemeIndex;
                return (
                  <div
                    key={idx}
                    className={`phoneme-score-card ${ps.status} ${isFailing ? 'failing-highlight' : ''}`}
                  >
                    <div className="phoneme-card-top">
                      <code className="ipa-symbol">{ps.phoneme}</code>
                      <span className={`status-badge ${ps.status}`}>
                        {ps.status === 'optimal' ? (
                          <CheckCircle2 size={12} />
                        ) : ps.status === 'warning' ? (
                          <AlertTriangle size={12} />
                        ) : (
                          <XCircle size={12} />
                        )}
                        {ps.score}%
                      </span>
                    </div>

                    <div className="time-range-tag">
                      Límites: {ps.startTimeMs}ms &ndash; {ps.endTimeMs}ms
                    </div>

                    <div className="formant-match-meters">
                      <div className="formant-meter">
                        <span>F1 Formante:</span>
                        <div className="meter-bar">
                          <div
                            className="meter-fill"
                            style={{ width: `${ps.formantMatchF1}%` }}
                          />
                        </div>
                      </div>
                      <div className="formant-meter">
                        <span>F2 Resonancia:</span>
                        <div className="meter-bar">
                          <div
                            className="meter-fill"
                            style={{ width: `${ps.formantMatchF2}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Si es Mandarín: Sección de Contorno de Tono F0 */}
          {selectedCase.language.startsWith('zh') && (
            <div className="mandarin-tone-section">
              <div className="tone-header-row">
                <Globe size={16} className="tone-icon" />
                <span className="section-label">Análisis de Contorno de Frecuencia Fundamental (F0):</span>
              </div>

              <div className="tone-details-grid">
                <div className="tone-box">
                  <span className="tone-box-title">Tono Canónico Esperado:</span>
                  <span className="tone-box-val tone-expected">
                    Tono {selectedCase.targetTone} ({selectedCase.targetPitchContour})
                  </span>
                </div>
                <div className="tone-box">
                  <span className="tone-box-title">Tono Acústico Emitido:</span>
                  <span className="tone-box-val tone-detected">
                    Tono {selectedCase.simulatedTone} ({analysisResult.toneResult?.detectedTone ? `Detectado: Tono ${analysisResult.toneResult.detectedTone}` : 'Curva F0'})
                  </span>
                </div>
              </div>

              {/* Simulación visual de la curva de tono F0 */}
              <div className="pitch-canvas-wrapper">
                <div className="pitch-axis-label">F0 (Hz)</div>
                <div className="pitch-curve-mock">
                  <div className="curve-target-line" title="Tono Canónico Esperado" />
                  <div className="curve-detected-line" title="Curva F0 Detectada del Alumno" />
                </div>
                <div className="pitch-time-labels">
                  <span>0ms</span>
                  <span>150ms</span>
                  <span>300ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Bloque Actuador FFmpeg en Segundo Plano */}
          <div className="ffmpeg-actuator-preview">
            <span className="actuator-title">Actuador FFmpeg (Background):</span>
            <p className="actuator-desc">
              Una vez detectado el fallo entre{' '}
              <strong>{selectedCase.timeRangeMs[0]} ms</strong> y{' '}
              <strong>{selectedCase.timeRangeMs[1]} ms</strong>, el sistema invoca de forma asíncrona:
            </p>
            <pre className="ffmpeg-command-box">
              ffmpeg -y -ss {(selectedCase.timeRangeMs[0] / 1000).toFixed(3)} -i input.wav -t {((selectedCase.timeRangeMs[1] - selectedCase.timeRangeMs[0]) / 1000).toFixed(3)} -c:a pcm_s16le -ar 16000 clip_error.wav
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
