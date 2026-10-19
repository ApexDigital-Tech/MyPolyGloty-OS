/**
 * Calibración del scorer heurístico CEFR.
 * Ejecutar: npx -y tsx scripts/run_cefr_calibration.ts
 *
 * IMPORTANTE: los textos de referencia están redactados a mano imitando producciones
 * típicas de cada banda (estilo descriptores MCER). No son un corpus oficial etiquetado
 * (p. ej. EFCAMDAT / Write & Improve). Sirven como prueba de cordura y regresión,
 * no como validación psicométrica.
 */
import { extractFeatures, scoreHeuristic } from '../src/assessment/textFeatures';
import { scoreToBand, bandIndex, type CefrBand } from '../src/types/cefr';

const SAMPLES: Array<{ band: CefrBand; text: string }> = [
  { band: 'A1', text: 'My name is Ana. I am from Spain. I like music.' },
  { band: 'A1', text: 'I work in office. I have 30 years. I like my job, is good.' },
  { band: 'A1', text: 'Yes. I live in Madrid with my family. My house is small.' },
  { band: 'A2', text: 'Last weekend I go to the beach with my friends. We eat fish and we play volleyball. It was very fun but I was tired.' },
  { band: 'A2', text: 'I work in a big company. Every day I take the bus to the office. I like my job because my colleagues are nice, but sometimes it is hard.' },
  { band: 'A2', text: 'Yesterday I visited my mother. She cooked paella for us and we watched a film. I was very happy.' },
  { band: 'B1', text: 'I have been working as a developer for three years. Before that, I studied computer science at university, which was quite difficult. I think the most important thing in my job is to communicate well with the team, because if we do not talk, the project fails.' },
  { band: 'B1', text: 'When I was younger I wanted to be a pilot, but then I discovered programming and I changed my mind. Now I would like to travel more, especially to Asia, because I am interested in the culture and the food.' },
  { band: 'B1', text: 'The best trip I remember was to Portugal. We rented a car and drove along the coast. Although the weather was not perfect, we enjoyed the small villages and the people were really friendly.' },
  { band: 'B2', text: 'In my current role I am responsible for maintaining the payment platform, which processes thousands of transactions per hour. Recently we noticed that latency had increased significantly, so we introduced a caching layer. As a result, response times dropped by forty percent, although it created some consistency issues that we are still addressing.' },
  { band: 'B2', text: 'I believe remote work has clear advantages, such as flexibility and the absence of commuting. However, it can also lead to isolation, particularly for junior employees who would benefit from informal mentoring. If I were managing a team, I would probably adopt a hybrid model.' },
  { band: 'B2', text: 'Had I known how demanding the migration would be, I would have planned a longer transition period. We underestimated the dependencies between services, and consequently several teams were blocked for weeks while the data was being reconciled.' },
  { band: 'C1', text: 'Admittedly, the decision to decompose the monolith was driven as much by organisational pressures as by technical merit. Whereas the original architecture had become a bottleneck for deployment velocity, the distributed alternative introduced operational overhead that we had arguably underestimated. In hindsight, a modular monolith would have delivered most of the benefits while sparing us the complexity of eventual consistency.' },
  { band: 'C1', text: 'What strikes me most about the debate on artificial intelligence in education is how polarised it has become. On the one hand, adaptive systems can tailor practice to individual learners with remarkable precision; on the other, there is a genuine risk that students outsource the very cognitive effort that consolidates learning. Striking a balance will require pedagogical judgement rather than blanket prohibition.' },
  { band: 'C2', text: 'Notwithstanding the superficial appeal of microservices, their adoption frequently reflects a conflation of architectural fashion with genuine necessity. Organisations that lack mature observability, rigorous contract testing and a culture of autonomous ownership tend to discover, belatedly, that they have merely redistributed their coupling across the network, thereby compounding latency, obscuring failure modes and eroding the very agility they had sought to cultivate.' },
  { band: 'C2', text: 'To characterise the policy as a failure would be to misconstrue its objectives, which were never primarily economic. Its architects were, by their own admission, preoccupied with legitimacy; the fiscal consequences, however regrettable, were a tolerated externality rather than an unforeseen miscalculation, and any serious appraisal ought to proceed from that premise.' },
];

let exact = 0;
let adjacent = 0;
const rows: string[] = [];
for (const s of SAMPLES) {
  const f = extractFeatures(s.text);
  const h = scoreHeuristic(s.text, f);
  const pred = scoreToBand(h.total);
  const diff = Math.abs(bandIndex(pred) - bandIndex(s.band));
  if (diff === 0) exact++;
  if (diff <= 1) adjacent++;
  rows.push(
    `${s.band} → ${pred} ${diff === 0 ? '✓' : diff === 1 ? '~' : '✗'}  score=${String(h.total).padStart(3)}  ` +
      `R=${h.range} C=${h.complexity} A=${h.accuracy} F=${h.fluency}  words=${f.wordCount} mattr=${f.mattr.toFixed(2)} soph=${f.lexicalSophistication.toFixed(2)} sub=${f.subordinationPerSentence.toFixed(2)}`
  );
}
console.log(rows.join('\n'));
console.log(`\nExacta: ${exact}/${SAMPLES.length} (${((exact / SAMPLES.length) * 100).toFixed(0)}%)`);
console.log(`Adyacente (±1 banda): ${adjacent}/${SAMPLES.length} (${((adjacent / SAMPLES.length) * 100).toFixed(0)}%)`);
const pass = adjacent / SAMPLES.length >= 0.9;
console.log(pass ? 'PASS: ≥90% dentro de ±1 banda' : 'FAIL: <90% dentro de ±1 banda');
process.exit(pass ? 0 : 1);
