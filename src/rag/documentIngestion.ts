/**
 * Ingesta de documentos del usuario (PDF, TXT, MD) + recuperación local BM25.
 * MyPolyGloty OS - Sprint 4
 *
 * Decisión de diseño: recuperación léxica BM25 100 % local en lugar de embeddings.
 * - Cero coste y cero envío del documento completo a terceros (local-first):
 *   solo los 3-4 fragmentos relevantes viajan en el prompt del LLM.
 * - Para guiones de roleplay (vocabulario específico, nombres propios, jerga)
 *   la coincidencia léxica funciona bien. Limitación: no captura sinónimos.
 *   Si en el futuro hace falta, se puede añadir un reranker con embeddings.
 *
 * pdfjs-dist se carga de forma diferida para no inflar el bundle inicial.
 */

export interface DocumentChunk {
  id: string;
  docId: string;
  index: number;
  text: string;
  tokens: string[];
}

export interface IngestedDocument {
  id: string;
  name: string;
  kind: 'pdf' | 'text';
  pageCount: number | null;
  charCount: number;
  chunks: DocumentChunk[];
  /** Términos clave del documento (TF-IDF sobre fragmentos), para el glosario del roleplay. */
  keyTerms: string[];
  ingestedAt: number;
  ingestMs: number;
}

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
const CHUNK_TARGET_WORDS = 120;
const CHUNK_OVERLAP_WORDS = 25;

const STOPWORDS = new Set(
  `a an and are as at be been being but by can could did do does for from had has have he her hers him his how i if in
  into is it its me my no not of on or our ours she should so than that the their them then there these they this those
  to too us was we were what when where which while who whom why will with would you your yours also just very more most
  such only own same other any each few some all both about above after again against below between during before over
  under up down out off once here further el la los las de del que y en un una por para con no se su al lo como más pero
  sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante`
    .split(/\s+/)
    .filter(Boolean)
);

export function tokenizeForSearch(text: string): string[] {
  return (text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+(?:[-'][a-z0-9]+)*/g) ?? [])
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : ''))
      .join('');
    pages.push(line);
  }
  pdf.cleanup();
  return { text: pages.join('\n\n'), pages: pdf.numPages };
}

/** Trocea por párrafos agrupándolos hasta ~120 palabras, con solapamiento de 25. */
export function chunkText(docId: string, text: string): DocumentChunk[] {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const chunks: DocumentChunk[] = [];
  if (words.length === 0) return chunks;

  const step = CHUNK_TARGET_WORDS - CHUNK_OVERLAP_WORDS;
  for (let start = 0, i = 0; start < words.length; start += step, i++) {
    const slice = words.slice(start, start + CHUNK_TARGET_WORDS).join(' ');
    chunks.push({ id: `${docId}-c${i}`, docId, index: i, text: slice, tokens: tokenizeForSearch(slice) });
    if (start + CHUNK_TARGET_WORDS >= words.length) break;
  }
  return chunks;
}

/** Top-N términos por TF-IDF agregado (unigramas y bigramas). */
export function extractKeyTerms(chunks: DocumentChunk[], topN = 18): string[] {
  const df = new Map<string, number>();
  const tf = new Map<string, number>();
  for (const c of chunks) {
    const terms = [...c.tokens, ...c.tokens.slice(1).map((t, i) => `${c.tokens[i]} ${t}`)];
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of new Set(terms)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = Math.max(1, chunks.length);
  const scored = [...tf.entries()]
    .filter(([t, f]) => f >= 2 && !/^\d+$/.test(t))
    .map(([t, f]) => {
      const idf = Math.log(1 + N / (df.get(t) ?? 1));
      const bigramBoost = t.includes(' ') ? 1.4 : 1;
      return [t, f * idf * bigramBoost] as const;
    })
    .sort((a, b) => b[1] - a[1]);

  // Evitar unigramas ya cubiertos por un bigrama seleccionado.
  const out: string[] = [];
  for (const [t] of scored) {
    if (out.length >= topN) break;
    if (!t.includes(' ') && out.some((o) => o.split(' ').includes(t))) continue;
    out.push(t);
  }
  return out;
}

export async function ingestFile(file: File): Promise<IngestedDocument> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`El archivo supera ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  const t0 = performance.now();
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  let text: string;
  let pageCount: number | null = null;

  if (isPdf) {
    const r = await extractPdfText(file);
    text = r.text;
    pageCount = r.pages;
  } else {
    text = await file.text();
  }

  if (text.trim().length < 40) {
    throw new Error(
      isPdf
        ? 'No se pudo extraer texto del PDF. Puede ser un PDF escaneado (imagen): se necesitaría OCR, no soportado aún.'
        : 'El documento está vacío o es demasiado corto.'
    );
  }
  return ingestText(file.name, text, isPdf ? 'pdf' : 'text', pageCount, t0);
}

export function ingestText(
  name: string,
  text: string,
  kind: 'pdf' | 'text' = 'text',
  pageCount: number | null = null,
  t0 = performance.now()
): IngestedDocument {
  const id = `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const chunks = chunkText(id, text);
  return {
    id,
    name,
    kind,
    pageCount,
    charCount: text.length,
    chunks,
    keyTerms: extractKeyTerms(chunks),
    ingestedAt: Date.now(),
    ingestMs: Math.round(performance.now() - t0),
  };
}

/** Índice BM25 (k1 = 1.5, b = 0.75) sobre los fragmentos de uno o varios documentos. */
export class Bm25Index {
  private readonly k1 = 1.5;
  private readonly b = 0.75;
  private df = new Map<string, number>();
  private avgLen = 0;
  private chunks: DocumentChunk[] = [];

  constructor(chunks: DocumentChunk[]) {
    this.chunks = chunks;
    let total = 0;
    for (const c of chunks) {
      total += c.tokens.length;
      for (const t of new Set(c.tokens)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgLen = chunks.length ? total / chunks.length : 0;
  }

  search(query: string, k = 4): Array<{ chunk: DocumentChunk; score: number }> {
    const q = tokenizeForSearch(query);
    if (q.length === 0 || this.chunks.length === 0) return [];
    const N = this.chunks.length;
    const results = this.chunks.map((chunk) => {
      const tf = new Map<string, number>();
      for (const t of chunk.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      let score = 0;
      for (const term of q) {
        const f = tf.get(term);
        if (!f) continue;
        const n = this.df.get(term) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * chunk.tokens.length) / this.avgLen));
      }
      return { chunk, score };
    });
    return results
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
