import React from 'react';
import type { LessonPack } from '../types/lesson';
import { BookOpen, Target, Sparkles, CheckSquare } from 'lucide-react';

interface LessonHeaderProps {
  lesson: LessonPack;
}

export const LessonHeader: React.FC<LessonHeaderProps> = ({ lesson }) => {
  return (
    <div className="lesson-header-card">
      <div className="lesson-top-meta">
        <div className="lesson-title-group">
          <span className="cefr-badge">{lesson.metadata.cefrLevel}</span>
          <h2 className="lesson-title">{lesson.metadata.title}</h2>
        </div>
        <span className="lang-badge">{lesson.metadata.targetLanguage}</span>
      </div>

      <p className="lesson-desc">{lesson.metadata.description}</p>

      <div className="scenario-box">
        <div className="scenario-item">
          <BookOpen size={14} className="scenario-icon" />
          <div>
            <strong>Situación:</strong> {lesson.scenario.situation}
          </div>
        </div>

        <div className="scenario-item">
          <Target size={14} className="scenario-icon" />
          <div>
            <strong>Tu Rol:</strong> {lesson.scenario.userRole} &bull; <strong>Meta:</strong> {lesson.scenario.goal}
          </div>
        </div>
      </div>

      <div className="targets-row">
        <div className="target-group">
          <span className="target-title">
            <Sparkles size={13} /> Foco Fonético ({lesson.rubric.phoneticTargets.length}):
          </span>
          <div className="phoneme-pills">
            {lesson.rubric.phoneticTargets.map((pt, idx) => (
              <span key={idx} className="phoneme-pill" title={`${pt.description} (ej. ${pt.wordExample})`}>
                <code>{pt.ipa}</code>
                <span className="pill-example">{pt.wordExample}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="target-group">
          <span className="target-title">
            <CheckSquare size={13} /> Gramática & Vocabulario:
          </span>
          <div className="vocab-pills">
            {lesson.rubric.grammarFocus.map((g, idx) => (
              <span key={idx} className="vocab-pill">
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
