import React, { useMemo, useState } from 'react';
import { ingestFile, ingestText, type IngestedDocument } from '../rag/documentIngestion';
import { RoleplaySession, SCENARIO_CATALOG, scenarioFromDocument, type Scenario } from '../rag/ScenarioEngine';
import type { DiagnosticResult } from '../types/cefr';
import { FileText, Upload, Play, Search, Briefcase, Siren, Coffee, Handshake, Sparkles, Loader2, X } from 'lucide-react';

interface ScenarioStudioProps {
  diagnosis: DiagnosticResult | null;
  onStart: (session: RoleplaySession) => void;
}

const CATEGORY_META: Record<Scenario['category'], { label: string; icon: React.ReactNode }> = {
  negotiation: { label: 'Negociación', icon: <Handshake size={14} /> },
  emergency: { label: 'Emergencia', icon: <Siren size={14} /> },
  'daily-life': { label: 'Vida cotidiana', icon: <Coffee size={14} /> },
  professional: { label: 'Profesional', icon: <Briefcase size={14} /> },
  custom: { label: 'Tu documento', icon: <FileText size={14} /> },
};

const BAND_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const ScenarioStudio: React.FC<ScenarioStudioProps> = ({ diagnosis, onStart }) => {
  const [doc, setDoc] = useState<IngestedDocument | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasted, setPasted] = useState('');
  const [roleHint, setRoleHint] = useState({ tutorRole: '', learnerRole: '', goal: '' });
  const [query, setQuery] = useState('');

  const band = diagnosis?.band ?? null;

  const handleFile = async (file: File) => {
    setError(null);
    setIsIngesting(true);
    try {
      setDoc(await ingestFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar el archivo.');
    } finally {
      setIsIngesting(false);
    }
  };

  const handlePasted = () => {
    if (pasted.trim().length < 40) {
      setError('Pega al menos un párrafo de texto.');
      return;
    }
    setError(null);
    setDoc(ingestText('Notas pegadas.txt', pasted));
  };

  const previewSession = useMemo(
    () => (doc ? new RoleplaySession(scenarioFromDocument(doc, roleHint), diagnosis, doc) : null),
    [doc, roleHint, diagnosis]
  );
  const retrieval = useMemo(
    () => (previewSession && query.trim() ? previewSession.retrieve(query) : []),
    [previewSession, query]
  );

  return (
    <div className="sc-shell">
      <header className="sc-header">
        <div>
          <h2 className="dx-title">Estudio de escenarios</h2>
          <p className="dx-subtitle">
            Elige un roleplay o sube tu propio material: el tutor adopta su papel y su vocabulario.
          </p>
        </div>
        <span className={`sc-band-chip ${band ? '' : 'muted'}`}>
          {band ? `Nivel diagnosticado: ${band}` : 'Sin diagnóstico · se asume B1'}
        </span>
      </header>

      {/* --- Documento propio (RAG) --- */}
      <section className="sc-doc-panel">
        <h3 className="dx-panel-title">
          <Sparkles size={15} /> Roleplay a partir de tu documento
        </h3>

        {!doc ? (
          <div className="sc-doc-inputs">
            <label
              htmlFor="sc-file-input"
              className={`sc-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
            >
              {isIngesting ? <Loader2 size={26} className="sc-spin" /> : <Upload size={26} />}
              <span className="sc-drop-title">{isIngesting ? 'Extrayendo texto…' : 'Arrastra un PDF, TXT o MD'}</span>
              <span className="sc-drop-hint">Se procesa en tu navegador · máx. 15 MB</span>
              <input
                id="sc-file-input"
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            <div className="sc-paste-box">
              <textarea
                id="sc-paste-input"
                className="dx-textarea"
                rows={5}
                placeholder="…o pega aquí tus apuntes, un guion o la descripción del puesto"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              <button id="sc-paste-btn" className="dx-demo-btn" onClick={handlePasted}>
                Usar texto pegado
              </button>
            </div>
          </div>
        ) : (
          <div className="sc-doc-loaded">
            <div className="sc-doc-meta">
              <FileText size={18} />
              <strong>{doc.name}</strong>
              <span>
                {doc.pageCount != null ? `${doc.pageCount} págs · ` : ''}
                {doc.chunks.length} fragmentos · {(doc.charCount / 1000).toFixed(1)}k caracteres · {doc.ingestMs} ms
              </span>
              <button id="sc-doc-clear" className="sc-icon-btn" onClick={() => setDoc(null)} aria-label="Quitar documento">
                <X size={14} />
              </button>
            </div>

            <div className="sc-terms">
              {doc.keyTerms.map((t) => (
                <span key={t} className="sc-term">
                  {t}
                </span>
              ))}
            </div>

            <div className="sc-role-grid">
              <input
                id="sc-role-tutor"
                className="sc-input"
                placeholder="Papel del tutor (opcional): p. ej. 'CTO del cliente'"
                value={roleHint.tutorRole}
                onChange={(e) => setRoleHint({ ...roleHint, tutorRole: e.target.value })}
              />
              <input
                id="sc-role-learner"
                className="sc-input"
                placeholder="Tu papel (opcional): p. ej. 'Consultor que presenta la propuesta'"
                value={roleHint.learnerRole}
                onChange={(e) => setRoleHint({ ...roleHint, learnerRole: e.target.value })}
              />
              <input
                id="sc-role-goal"
                className="sc-input"
                placeholder="Objetivo (opcional): p. ej. 'Defender el presupuesto'"
                value={roleHint.goal}
                onChange={(e) => setRoleHint({ ...roleHint, goal: e.target.value })}
              />
            </div>

            <div className="sc-retrieval">
              <div className="sc-search-row">
                <Search size={14} />
                <input
                  id="sc-retrieval-query"
                  className="sc-input bare"
                  placeholder="Prueba la recuperación: escribe lo que dirías en la conversación…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {retrieval.map((r) => (
                <div key={r.chunkIndex} className="sc-chunk">
                  <span className="sc-chunk-score">#{r.chunkIndex} · BM25 {r.score}</span>
                  <p>{r.text.slice(0, 280)}{r.text.length > 280 ? '…' : ''}</p>
                </div>
              ))}
              {query.trim() && retrieval.length === 0 && (
                <p className="dx-note">Ningún fragmento coincide léxicamente con esa frase.</p>
              )}
            </div>

            <button
              id="sc-start-doc-btn"
              className="dx-submit-btn wide"
              onClick={() => previewSession && onStart(previewSession)}
            >
              <Play size={14} /> Iniciar roleplay con este documento
            </button>
          </div>
        )}
        {error && <p className="sc-error">{error}</p>}
      </section>

      {/* --- Catálogo --- */}
      <section className="sc-catalog">
        {SCENARIO_CATALOG.map((s) => {
          const meta = CATEGORY_META[s.category];
          const belowLevel = band ? BAND_ORDER.indexOf(band) < BAND_ORDER.indexOf(s.minBand) : false;
          return (
            <article key={s.id} className={`sc-card ${belowLevel ? 'stretch' : ''}`}>
              <div className="sc-card-top">
                <span className="sc-cat">
                  {meta.icon} {meta.label}
                </span>
                <span className="dx-band-tag small">{s.minBand}+</span>
              </div>
              <h4 className="sc-card-title">{s.title}</h4>
              <p className="sc-card-goal">{s.goal}</p>
              {belowLevel && <p className="sc-stretch-note">Reto por encima de tu nivel actual</p>}
              <button
                id={`sc-start-${s.id}`}
                className="sc-card-btn"
                onClick={() => onStart(new RoleplaySession(s, diagnosis, null))}
              >
                <Play size={13} /> Empezar
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
};
