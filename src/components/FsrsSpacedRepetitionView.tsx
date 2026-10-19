import React, { useState, useEffect } from 'react';
import { FSRSScheduler, type FSRSCard, type FSRSRating } from '../services/fsrsScheduler';
import {
  Brain,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';

export const FsrsSpacedRepetitionView: React.FC = () => {
  const scheduler = FSRSScheduler.getInstance();
  const [cards, setCards] = useState<FSRSCard[]>(() => scheduler.getAllCards());
  const [dueCards, setDueCards] = useState<FSRSCard[]>(() => scheduler.getDueCards());
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [justReviewed, setJustReviewed] = useState<{ card: FSRSCard; rating: FSRSRating } | null>(null);

  const activeCard = dueCards[currentIndex] || null;

  const refreshState = () => {
    setCards(scheduler.getAllCards());
    const due = scheduler.getDueCards();
    setDueCards(due);
    if (currentIndex >= due.length) {
      setCurrentIndex(0);
    }
    setIsRevealed(false);
  };

  useEffect(() => {
    refreshState();
  }, []);

  const handleRate = (rating: FSRSRating) => {
    if (!activeCard) return;
    const updated = scheduler.reviewCard(activeCard.id, rating);
    setJustReviewed({ card: updated, rating });
    setTimeout(() => setJustReviewed(null), 3000);
    refreshState();
  };

  const getCardTypeBadge = (type: FSRSCard['type']) => {
    switch (type) {
      case 'phonetic':
        return <span className="fsrs-badge phonetic">Fonético IPA</span>;
      case 'tone':
        return <span className="fsrs-badge tone">Tono Mandarín</span>;
      case 'grammar':
        return <span className="fsrs-badge grammar">Gramatical</span>;
      case 'lexical':
        return <span className="fsrs-badge lexical">Léxico</span>;
    }
  };

  return (
    <div className="fsrs-container">
      {/* Top Header */}
      <div className="fsrs-header-row">
        <div>
          <div className="fsrs-header-title">
            <Brain className="fsrs-icon-spin" size={24} />
            <h2>Repetición Espaciada Inteligente (FSRS v4.5)</h2>
          </div>
          <p className="fsrs-header-sub">
            Algoritmo DSR (Dificultad, Estabilidad y Retentividad). Programa de forma matemática la
            reaparición orgánica de tus errores fonéticos y gramaticales en futuros diálogos.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="fsrs-stats-pills">
          <div className="fsrs-stat-pill">
            <Layers size={15} />
            <span>Mazo Total: <strong>{cards.length}</strong></span>
          </div>
          <div className="fsrs-stat-pill highlight">
            <Calendar size={15} />
            <span>Pendientes Hoy: <strong>{dueCards.length}</strong></span>
          </div>
          <div className="fsrs-stat-pill">
            <TrendingUp size={15} />
            <span>Retención Obj: <strong>90%</strong></span>
          </div>
        </div>
      </div>

      {/* Main Flashcard Practice Area */}
      <div className="fsrs-grid">
        <div className="fsrs-card-viewport">
          {activeCard ? (
            <div className={`fsrs-flashcard ${isRevealed ? 'revealed' : ''}`}>
              <div className="fsrs-card-top-bar">
                {getCardTypeBadge(activeCard.type)}
                <span className="fsrs-card-difficulty">
                  Dificultad: {activeCard.difficulty.toFixed(1)}/10
                </span>
                <span className="fsrs-card-reps">Repasos: {activeCard.reps}</span>
              </div>

              {/* Front of card */}
              <div className="fsrs-card-front">
                <span className="fsrs-prompt-label">Ítem a corregir / asimilar:</span>
                <h3 className="fsrs-item-title">{activeCard.item}</h3>
                {activeCard.ipa && <p className="fsrs-ipa-text">{activeCard.ipa}</p>}

                <div className="fsrs-context-box">
                  <span className="fsrs-context-label">Contexto conversacional:</span>
                  <p className="fsrs-context-text">"{activeCard.contextSentence}"</p>
                </div>
              </div>

              {/* Reveal toggle button */}
              {!isRevealed ? (
                <button
                  className="fsrs-reveal-btn"
                  onClick={() => setIsRevealed(true)}
                  autoFocus
                >
                  <Sparkles size={16} /> Mostrar Respuesta y Calificar
                </button>
              ) : (
                /* Rating Buttons (FSRS v4.5 4-scale rating) */
                <div className="fsrs-rating-container">
                  <span className="fsrs-rating-instruction">
                    ¿Cómo fue tu retención mental y pronunciación?
                  </span>
                  <div className="fsrs-rating-buttons">
                    <button
                      className="fsrs-btn-rate again"
                      onClick={() => handleRate(1)}
                      title="Fallo o bloqueo total. Reinicia estabilidad."
                    >
                      <RotateCcw size={16} />
                      <div className="btn-label-group">
                        <span className="rating-name">Again (1)</span>
                        <span className="rating-desc">Fallo</span>
                      </div>
                    </button>
                    <button
                      className="fsrs-btn-rate hard"
                      onClick={() => handleRate(2)}
                      title="Recordado con esfuerzo y vacilación."
                    >
                      <div className="btn-label-group">
                        <span className="rating-name">Hard (2)</span>
                        <span className="rating-desc">Dudoso</span>
                      </div>
                    </button>
                    <button
                      className="fsrs-btn-rate good"
                      onClick={() => handleRate(3)}
                      title="Recordado con precisión en tiempo estándar."
                    >
                      <CheckCircle2 size={16} />
                      <div className="btn-label-group">
                        <span className="rating-name">Good (3)</span>
                        <span className="rating-desc">Correcto</span>
                      </div>
                    </button>
                    <button
                      className="fsrs-btn-rate easy"
                      onClick={() => handleRate(4)}
                      title="Respuesta inmediata, natural y sin titubeos."
                    >
                      <Award size={16} />
                      <div className="btn-label-group">
                        <span className="rating-name">Easy (4)</span>
                        <span className="rating-desc">Fluido</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="fsrs-empty-box">
              <CheckCircle2 size={48} className="empty-check-icon" />
              <h3>¡Todo al día!</h3>
              <p>Has completado todos los repasos programados para hoy con el algoritmo FSRS.</p>
              <span className="empty-sub">
                Los errores que cometas en tus próximas llamadas se incorporarán automáticamente aquí.
              </span>
            </div>
          )}

          {/* Toast Notification of schedule */}
          {justReviewed && (
            <div className="fsrs-toast-review">
              <Sparkles size={16} />
              <span>
                <strong>{justReviewed.card.item}</strong> programado para dentro de{' '}
                <strong>{justReviewed.card.scheduledDays} días</strong> (Estabilidad:{' '}
                {justReviewed.card.stability}d).
              </span>
            </div>
          )}
        </div>

        {/* Side Panel: Deck Ledger and Organic Injection Preview */}
        <div className="fsrs-side-panel">
          <div className="fsrs-side-card">
            <h4 className="side-card-title">
              <Brain size={16} /> Inyección Orgánica al Tutor LLM
            </h4>
            <p className="side-card-desc">
              Estos ítems con mayor índice de olvido serán integrados de forma invisible por el LLM en
              tus próximas simulaciones de rol:
            </p>
            <ul className="fsrs-injection-list">
              {scheduler.getOrganicPromptInjectors(4).map((inj, idx) => (
                <li key={idx} className="injection-item">
                  <ArrowRight size={14} className="inj-arrow" />
                  <span>{inj}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="fsrs-side-card">
            <h4 className="side-card-title">
              <Layers size={16} /> Estado de la Baraja Activa
            </h4>
            <div className="fsrs-deck-list">
              {cards.map((c) => (
                <div key={c.id} className="deck-card-row">
                  <div className="deck-row-left">
                    <span className="deck-row-title">{c.item}</span>
                    <span className="deck-row-meta">
                      Estabilidad: {c.stability}d | Dif: {c.difficulty}
                    </span>
                  </div>
                  <div className="deck-row-right">
                    <span className={`deck-state-pill ${c.state}`}>{c.state}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
