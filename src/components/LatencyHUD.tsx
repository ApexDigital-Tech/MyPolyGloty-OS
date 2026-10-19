import React, { useState } from 'react';
import { LATENCY_TARGETS, type LatencyBreakdown, type LatencyStats } from '../types/telemetry';
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Gauge, History, Zap } from 'lucide-react';

interface LatencyHUDProps {
  currentBreakdown: LatencyBreakdown | null;
  history: LatencyBreakdown[];
  stats: LatencyStats;
  onSimulateTurn: () => void;
  isSimulating: boolean;
}

export const LatencyHUD: React.FC<LatencyHUDProps> = ({
  currentBreakdown,
  history,
  stats,
  onSimulateTurn,
  isSimulating,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  const total = currentBreakdown?.totalTurnToEarMs ?? 0;
  const isOptimal = total > 0 && total <= LATENCY_TARGETS.P50_TARGET;
  const isWarning = total > LATENCY_TARGETS.P50_TARGET && total <= LATENCY_TARGETS.P95_LIMIT;

  const tramosList = [
    { key: 't1_vadSilenceMs', ...LATENCY_TARGETS.TRAMOS.t1, val: currentBreakdown?.t1_vadSilenceMs ?? 0 },
    { key: 't2_clientBufferMs', ...LATENCY_TARGETS.TRAMOS.t2, val: currentBreakdown?.t2_clientBufferMs ?? 0 },
    { key: 't3_sttMs', ...LATENCY_TARGETS.TRAMOS.t3, val: currentBreakdown?.t3_sttMs ?? 0 },
    { key: 't4_llmFirstTokenMs', ...LATENCY_TARGETS.TRAMOS.t4, val: currentBreakdown?.t4_llmFirstTokenMs ?? 0 },
    { key: 't5_sentenceChunkMs', ...LATENCY_TARGETS.TRAMOS.t5, val: currentBreakdown?.t5_sentenceChunkMs ?? 0 },
    { key: 't6_ttsFirstChunkMs', ...LATENCY_TARGETS.TRAMOS.t6, val: currentBreakdown?.t6_ttsFirstChunkMs ?? 0 },
    { key: 't7_playbackInitMs', ...LATENCY_TARGETS.TRAMOS.t7, val: currentBreakdown?.t7_playbackInitMs ?? 0 },
  ];

  return (
    <div className={`latency-hud-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="latency-hud-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="hud-title-section">
          <Activity className="hud-icon pulse" />
          <span className="hud-title">Latency Budget HUD</span>
          <span className="hud-badge-version">v2.0 E2E</span>
        </div>

        <div className="hud-metric-pill">
          {total > 0 ? (
            <span className={`hud-metric-value ${isOptimal ? 'optimal' : isWarning ? 'warning' : 'breach'}`}>
              {total} ms
            </span>
          ) : (
            <span className="hud-metric-idle">Standby</span>
          )}
          <span className="hud-target-text">P50: &lt;{LATENCY_TARGETS.P50_TARGET}ms</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isExpanded && (
        <div className="latency-hud-body">
          {/* Barra de Tabs y Stats */}
          <div className="hud-tab-bar">
            <div className="hud-tabs">
              <button
                className={`hud-tab-btn ${activeTab === 'current' ? 'active' : ''}`}
                onClick={() => setActiveTab('current')}
              >
                <Gauge size={14} /> Turno Actual
              </button>
              <button
                className={`hud-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <History size={14} /> Historial ({history.length})
              </button>
            </div>

            <button
              className="hud-sim-btn"
              onClick={onSimulateTurn}
              disabled={isSimulating}
              title="Simula un ciclo conversacional Turn-to-Ear real con latencias ponderadas"
            >
              <Zap size={14} />
              {isSimulating ? 'Midiendo...' : 'Test Turn-to-Ear'}
            </button>
          </div>

          {/* Resumen P50 / P95 */}
          <div className="hud-stats-grid">
            <div className="hud-stat-card">
              <span className="hud-stat-label">P50 Observado</span>
              <span className="hud-stat-val p50">{stats.p50} ms</span>
              <span className="hud-stat-target">Meta: &le; 760ms</span>
            </div>
            <div className="hud-stat-card">
              <span className="hud-stat-label">P95 Observado</span>
              <span className={`hud-stat-val ${stats.p95 <= LATENCY_TARGETS.P95_LIMIT ? 'p95-ok' : 'p95-bad'}`}>
                {stats.p95} ms
              </span>
              <span className="hud-stat-target">Límite: &le; 1150ms</span>
            </div>
            <div className="hud-stat-card">
              <span className="hud-stat-label">Desbordes P95</span>
              <span className={`hud-stat-val ${stats.breachCount === 0 ? 'zero' : 'alert'}`}>
                {stats.breachCount}
              </span>
              <span className="hud-stat-target">Total: {stats.count} turnos</span>
            </div>
          </div>

          {activeTab === 'current' ? (
            <div className="hud-tramos-container">
              {currentBreakdown ? (
                <>
                  <div className="hud-total-banner">
                    <div className="total-indicator">
                      {isOptimal ? (
                        <CheckCircle2 className="icon-success" size={20} />
                      ) : isWarning ? (
                        <AlertTriangle className="icon-warning" size={20} />
                      ) : (
                        <AlertTriangle className="icon-breach" size={20} />
                      )}
                      <div>
                        <strong>Latencia Total: {currentBreakdown.totalTurnToEarMs} ms</strong>
                        <div className="total-sub">
                          {isOptimal
                            ? 'Excelente: Percepción fluida y conversacional'
                            : isWarning
                            ? 'Aceptable dentro del margen P95'
                            : 'Alerta: Excede presupuesto humano de 1150ms'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="tramos-list">
                    {tramosList.map((t) => {
                      const pct = Math.min(100, (t.val / t.p95) * 100);
                      const isTramoOver = t.val > t.p95;
                      return (
                        <div key={t.key} className="tramo-row">
                          <div className="tramo-info">
                            <span className="tramo-name">{t.name}</span>
                            <span className="tramo-desc">{t.desc}</span>
                          </div>
                          <div className="tramo-metric-bar-wrapper">
                            <div className="tramo-bar-bg">
                              <div
                                className={`tramo-bar-fill ${isTramoOver ? 'bar-breach' : 'bar-normal'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`tramo-val ${isTramoOver ? 'text-breach' : ''}`}>
                              {t.val} ms
                            </span>
                            <span className="tramo-budget">/{t.p50}ms</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="hud-empty-state">
                  <p>Inicia el micrófono o haz clic en <strong>Test Turn-to-Ear</strong> para medir los tramos T1-T7 en vivo.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="hud-history-container">
              {history.length === 0 ? (
                <p className="hud-empty-text">Aún no se han registrado turnos de audio.</p>
              ) : (
                <div className="history-table-wrapper">
                  <table className="hud-history-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>VAD (T1)</th>
                        <th>Worklet (T2)</th>
                        <th>STT (T3)</th>
                        <th>LLM (T4)</th>
                        <th>Chunk (T5)</th>
                        <th>TTS (T6)</th>
                        <th>Play (T7)</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(-10).reverse().map((h) => (
                        <tr key={h.timestamp} className={h.status}>
                          <td>{h.turnIndex}</td>
                          <td>{h.t1_vadSilenceMs}ms</td>
                          <td>{h.t2_clientBufferMs}ms</td>
                          <td>{h.t3_sttMs}ms</td>
                          <td>{h.t4_llmFirstTokenMs}ms</td>
                          <td>{h.t5_sentenceChunkMs}ms</td>
                          <td>{h.t6_ttsFirstChunkMs}ms</td>
                          <td>{h.t7_playbackInitMs}ms</td>
                          <td className="bold-cell">{h.totalTurnToEarMs}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
