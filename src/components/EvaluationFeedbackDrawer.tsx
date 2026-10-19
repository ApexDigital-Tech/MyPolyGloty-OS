import React, { useState } from 'react';
import { type PedagogicalEvaluation } from '../types/byok';
import { Award, CheckCircle2, ChevronDown, ChevronUp, BookOpen, AlertCircle, ArrowRight, Lightbulb } from 'lucide-react';

interface EvaluationFeedbackDrawerProps {
  evaluation: PedagogicalEvaluation | null;
  isEvaluating: boolean;
}

export const EvaluationFeedbackDrawer: React.FC<EvaluationFeedbackDrawerProps> = ({
  evaluation,
  isEvaluating,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!evaluation && !isEvaluating) {
    return null;
  }

  return (
    <div className={`eval-feedback-card ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="eval-card-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="eval-header-title">
          <Award className="eval-header-icon" size={18} />
          <div>
            <span className="eval-card-heading">Agente Evaluador (Background)</span>
            <span className="eval-subtext">
              {isEvaluating
                ? 'Analizando sintaxis y vocabulario en paralelo...'
                : `Banda CEFR: ${evaluation?.cefrBand || 'B1'} &bull; Gramática: ${evaluation?.grammarScore || 90}%`}
            </span>
          </div>
        </div>

        <div className="eval-toggle-wrapper">
          {evaluation && (
            <span className="eval-score-pill">
              {evaluation.grammarScore >= 80 ? (
                <CheckCircle2 size={13} className="text-green" />
              ) : (
                <AlertCircle size={13} className="text-amber" />
              )}
              {evaluation.grammarScore}/100
            </span>
          )}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isExpanded && (
        <div className="eval-card-body">
          {isEvaluating ? (
            <div className="eval-loading-state">
              <div className="eval-pulsing-bar" />
              <p>El evaluador asíncrono está extrayendo correcciones en formato JSON estructurado sin frenar al tutor...</p>
            </div>
          ) : evaluation ? (
            <>
              {/* Feedback Positivo y Recomendación */}
              <div className="positive-feedback-box">
                <Lightbulb size={16} className="tip-icon" />
                <div>
                  <p className="feedback-text">{evaluation.positiveFeedback}</p>
                  <p className="recommendation-text">{evaluation.nextStepRecommendation}</p>
                </div>
              </div>

              {/* Errores Gramaticales Detectados */}
              {evaluation.errors.length > 0 && (
                <div className="eval-section">
                  <span className="eval-section-title">
                    <AlertCircle size={13} /> Correcciones Gramaticales ({evaluation.errors.length}):
                  </span>
                  <div className="errors-list">
                    {evaluation.errors.map((err, idx) => (
                      <div key={idx} className="error-card-item">
                        <div className="error-text-row">
                          <span className="original-wrong">"{err.original}"</span>
                          <ArrowRight size={13} className="arrow-icon" />
                          <span className="corrected-right">"{err.corrected}"</span>
                        </div>
                        <p className="error-rule-explanation">{err.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugerencias de Vocabulario de Nivel Superior */}
              {evaluation.vocabularySuggestions.length > 0 && (
                <div className="eval-section">
                  <span className="eval-section-title">
                    <BookOpen size={13} /> Vocabulario Avanzado Sugerido:
                  </span>
                  <div className="vocab-suggestions-grid">
                    {evaluation.vocabularySuggestions.map((sug, idx) => (
                      <div key={idx} className="vocab-suggestion-item">
                        <div className="vocab-meta-row">
                          <span className="vocab-level-tag">{sug.cefrLevel}</span>
                          <span className="vocab-better-word">{sug.betterAlternative}</span>
                        </div>
                        <p className="vocab-reason-text">
                          En vez de "{sug.original}": {sug.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};
