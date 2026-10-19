import React, { useMemo, useRef, useState } from 'react';
import { CefrDiagnosticEngine, TOTAL_TURNS } from '../assessment/CefrDiagnosticEngine';
import { FRICTION_LABELS } from '../assessment/frictionDetector';
import { CEFR_BANDS, type DiagnosticResult, type TurnAssessment } from '../types/cefr';
import { Gauge, Send, RotateCcw, Sparkles, Brain, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface CefrDiagnosticViewProps {
  onComplete: (result: DiagnosticResult) => void;
  initialResult: DiagnosticResult | null;
}

/** Respuestas de ejemplo para probar el flujo sin escribir (claramente marcadas como demo). */
const DEMO_ANSWERS: Record<string, string> = {
  A2: 'I work in a office. I like my job because my colleagues are nice. Last week I go to Valencia with my family and we eat paella.',
  B1: 'I have been working as a developer for three years. I think the most important thing is to communicate well with the team, because if we do not talk, the project fails.',
  C1: 'Admittedly, the decision was driven as much by organisational pressures as by technical merit. Whereas the original approach had become a bottleneck, the alternative introduced overhead that we had arguably underestimated.',
};

export const CefrDiagnosticView: React.FC<CefrDiagnosticViewProps> = ({ onComplete, initialResult }) => {
  const engineRef = useRef<CefrDiagnosticEngine>(new CefrDiagnosticEngine());
  const [answer, setAnswer] = useState('');
  const [turns, setTurns] = useState<TurnAssessment[]>([]);
  const [isScoring, setIsScoring] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(initialResult);
  const [probe, setProbe] = useState(engineRef.current.probe);

  const wordCount = useMemo(() => (answer.match(/[A-Za-z']+/g) ?? []).length, [answer]);

  const restart = () => {
    engineRef.current = new CefrDiagnosticEngine();
    setProbe(engineRef.current.probe);
    setTurns([]);
    setAnswer('');
    setResult(null);
  };

  const submit = async () => {
    if (!answer.trim() || isScoring) return;
    setIsScoring(true);
    try {
      // Respuesta escrita: no hay señal temporal de voz, así que no se inventa.
      const t = await engineRef.current.submitAnswer(answer.trim(), {
        responseOnsetMs: null,
        speechDurationMs: null,
        longPauseCount: null,
        phoneticScore: null,
      });
      setTurns(engineRef.current.history);
      setAnswer('');
      if (engineRef.current.isComplete) {
        const r = engineRef.current.finalize();
        setResult(r);
        onComplete(r);
      } else {
        setProbe(engineRef.current.probe);
      }
      void t;
    } finally {
      setIsScoring(false);
    }
  };

  if (result) return <DiagnosticResultCard result={result} onRestart={restart} />;

  return (
    <div className="dx-shell">
      <header className="dx-header">
        <div className="dx-title-row">
          <Gauge size={22} className="dx-title-icon" />
          <div>
            <h2 className="dx-title">Diagnóstico CEFR adaptativo</h2>
            <p className="dx-subtitle">5 turnos · 6 bandas · la dificultad se ajusta a cada respuesta</p>
          </div>
        </div>
        <div className="dx-progress" aria-label={`Turno ${turns.length + 1} de ${TOTAL_TURNS}`}>
          {Array.from({ length: TOTAL_TURNS }).map((_, i) => (
            <span
              key={i}
              className={`dx-progress-dot ${i < turns.length ? 'done' : i === turns.length ? 'current' : ''}`}
            >
              {i < turns.length ? turns[i].estimatedBand : i + 1}
            </span>
          ))}
        </div>
      </header>

      <section className="dx-probe-card">
        <div className="dx-probe-meta">
          <span className="dx-band-tag">Sonda {probe.targetBand}</span>
          <span className="dx-skill">{probe.skill}</span>
        </div>
        <p className="dx-probe-text">“{probe.prompt}”</p>
      </section>

      <section className="dx-answer-card">
        <label htmlFor="dx-answer-input" className="dx-label">
          Tu respuesta (en inglés)
        </label>
        <textarea
          id="dx-answer-input"
          className="dx-textarea"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
          }}
          placeholder="Responde con naturalidad, como lo dirías en voz alta…"
          rows={5}
          disabled={isScoring}
        />
        <div className="dx-answer-footer">
          <span className="dx-wordcount">{wordCount} palabras</span>
          <div className="dx-demo-row">
            <span className="dx-demo-label">Demo:</span>
            {Object.keys(DEMO_ANSWERS).map((b) => (
              <button
                key={b}
                id={`dx-demo-${b}`}
                className="dx-demo-btn"
                onClick={() => setAnswer(DEMO_ANSWERS[b])}
                disabled={isScoring}
              >
                {b}
              </button>
            ))}
          </div>
          <button id="dx-submit-btn" className="dx-submit-btn" onClick={submit} disabled={!answer.trim() || isScoring}>
            {isScoring ? 'Evaluando…' : (<><Send size={14} /> Enviar</>)}
          </button>
        </div>
        <p className="dx-note">
          <Info size={12} /> Respuesta escrita: la fluidez temporal no se puede medir y no cuenta en la nota.
          Con clave Groq en BYOK se añade un evaluador LLM.
        </p>
      </section>

      {turns.length > 0 && (
        <section className="dx-turn-log">
          {turns.map((t, i) => (
            <div key={i} className="dx-turn-row">
              <span className="dx-turn-idx">T{i + 1}</span>
              <span className="dx-band-tag small">{t.probe.targetBand}</span>
              <span className="dx-turn-answer">{t.answer}</span>
              <span className="dx-turn-score" title={t.llmRationale ?? 'Solo heurística'}>
                {t.combinedScore} → <strong>{t.estimatedBand}</strong>
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

const DiagnosticResultCard: React.FC<{ result: DiagnosticResult; onRestart: () => void }> = ({ result, onRestart }) => {
  const [lo, hi] = result.confidenceRange;
  const loI = CEFR_BANDS.indexOf(lo);
  const hiI = CEFR_BANDS.indexOf(hi);
  const sub = [
    { k: 'Rango léxico', v: result.subScores.range },
    { k: 'Complejidad', v: result.subScores.complexity },
    { k: 'Corrección', v: result.subScores.accuracy },
    { k: 'Fluidez', v: result.subScores.fluency, na: result.turns.every((t) => t.timing.speechDurationMs == null) },
  ];
  const frictions = [...result.frictions].sort((a, b) => b.intensity - a.intensity);

  return (
    <div className="dx-shell">
      <section className="dx-result-hero">
        <div className="dx-result-band-orb">
          <span className="dx-result-band">{result.band}</span>
          <span className="dx-result-score">{result.score}/100</span>
        </div>
        <div className="dx-result-summary">
          <h2 className="dx-title">Tu nivel estimado</h2>
          <p className="dx-subtitle">
            Rango plausible <strong>{lo === hi ? lo : `${lo}–${hi}`}</strong> · confianza{' '}
            {Math.round(result.confidence * 100)}% · método {result.method === 'heuristic' ? 'heurístico' : 'heurístico + LLM'}
          </p>
          <div className="dx-ladder" role="img" aria-label={`Banda ${result.band}`}>
            {CEFR_BANDS.map((b, i) => (
              <div
                key={b}
                className={`dx-ladder-step ${b === result.band ? 'active' : ''} ${i >= loI && i <= hiI ? 'in-range' : ''}`}
              >
                {b}
              </div>
            ))}
          </div>
          <p className="dx-note">
            <AlertTriangle size={12} /> Estimación de colocación, no certificación oficial. Se recalibra con el uso.
          </p>
        </div>
        <button id="dx-restart-btn" className="dx-restart-btn" onClick={onRestart}>
          <RotateCcw size={14} /> Repetir
        </button>
      </section>

      <div className="dx-result-grid">
        <section className="dx-panel">
          <h3 className="dx-panel-title">
            <Sparkles size={15} /> Subpuntuaciones
          </h3>
          {sub.map((s) => (
            <div key={s.k} className="dx-bar-row">
              <span className="dx-bar-label">{s.k}</span>
              <div className="dx-bar-track">
                <div className="dx-bar-fill" style={{ width: s.na ? '0%' : `${s.v}%` }} />
              </div>
              <span className="dx-bar-val">{s.na ? 'n/d' : s.v}</span>
            </div>
          ))}
        </section>

        <section className="dx-panel">
          <h3 className="dx-panel-title">
            <Brain size={15} /> Fricciones del habla
          </h3>
          {frictions.map((f) => {
            const label = FRICTION_LABELS[f.type];
            const level = f.intensity >= 0.6 ? 'high' : f.intensity >= 0.3 ? 'mid' : 'low';
            return (
              <div key={f.type} className={`dx-friction ${level}`}>
                <div className="dx-friction-head">
                  <span>{label.name}</span>
                  <span className="dx-friction-val">
                    {level === 'low' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {Math.round(f.intensity * 100)}%
                  </span>
                </div>
                {f.evidence.length > 0 && <p className="dx-friction-ev">{f.evidence.join(' · ')}</p>}
                {level !== 'low' && <p className="dx-friction-remedy">{label.remedy}</p>}
              </div>
            );
          })}
          {result.turns.every((t) => t.timing.responseOnsetMs == null) && (
            <p className="dx-note">
              <Info size={12} /> Sin audio, la latencia de traducción y el bloqueo fonético solo se estiman parcialmente.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
