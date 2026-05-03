const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

let useRealEmbedding = false;
let realCreateEmbedding = null;
try {
  const ollama = require('../src/services/ollamaService');
  if (ollama && typeof ollama.createEmbedding === 'function') {
    realCreateEmbedding = ollama.createEmbedding;
    useRealEmbedding = true;
    console.log('Using real embedding from ../src/services/ollamaService');
  }
} catch (e) {
  // ignore — fallback to fake
}

function chunkText(text, chunkSize = 700, overlap = 120) {
  if (!text) return [];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function createEmbeddingFake(text, dim = 128) {
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) vec[i % dim] += (text.charCodeAt(i) % 97) + 1;
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

// MUN-focused corpus (small reproducible set). Replace or point to your real corpus.
const docs = [
  { id: 'mun-1', text: 'Security Council: nuclear non-proliferation, sanctions, UN peacekeeping operations, Chapter VII enforcement.' },
  { id: 'mun-2', text: 'Human Rights: freedom of expression, minority protections, refugee rights, ICC referrals.' },
  { id: 'mun-3', text: 'Economic Development: sustainable finance, development aid, trade policy, debt relief.' },
  { id: 'mun-4', text: 'Climate Change: mitigation, adaptation funding, loss and damage, NDCs and global stocktake.' },
  { id: 'mun-5', text: 'Disarmament: arms control treaties, small arms proliferation, verification regimes.' },
  { id: 'mun-6', text: 'Health: pandemic preparedness, global vaccine distribution, WHO strengthening.' },
  { id: 'mun-7', text: 'Technology and AI: responsible AI governance, cross-border data flows, cyber norms.' },
  { id: 'mun-8', text: 'Humanitarian Assistance: access to civilians, humanitarian corridors, coordination.' },
  { id: 'mun-9', text: 'Environment: biodiversity, ocean protection, transboundary pollution.' },
  { id: 'mun-10', text: 'Education: SDG4, access to schooling, financing education in crisis settings.' },
];

const queries = [
  { q: 'What are enforceable sanctions options in the Security Council for non-compliance?', relevant: ['mun-1'] },
  { q: 'How can the UN improve refugee protections for displaced minorities?', relevant: ['mun-2'] },
  { q: 'What financing mechanisms support sustainable development in low-income countries?', relevant: ['mun-3'] },
  { q: 'What are loss and damage funding options under climate agreements?', relevant: ['mun-4'] },
  { q: 'Which treaties address small arms proliferation?', relevant: ['mun-5'] },
  { q: 'How to strengthen global pandemic preparedness?', relevant: ['mun-6'] },
  { q: 'What governance approaches exist for international AI norms?', relevant: ['mun-7'] },
  { q: 'How should humanitarian corridors be established safely?', relevant: ['mun-8'] },
  { q: 'What international mechanisms protect biodiversity hotspots?', relevant: ['mun-9'] },
  { q: 'How can education be financed in protracted crises?', relevant: ['mun-10'] },
];

const VECTOR_STORE_FILE = path.join(__dirname, '..', 'data', 'bench-mun-vector-store.json');
const TOP_K = 3;

async function embed(text) {
  if (useRealEmbedding && realCreateEmbedding) {
    const res = realCreateEmbedding(text);
    if (res && typeof res.then === 'function') return (await res).embedding ?? (await res);
    return res.embedding ?? res;
  }
  return createEmbeddingFake(text);
}

async function run() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const index = [];
  const indexTimes = [];
  for (const doc of docs) {
    const t0 = performance.now();
    const chunks = chunkText(doc.text, 300, 50);
    for (let i = 0; i < chunks.length; i++) {
      const emb = await embed(chunks[i]);
      index.push({ id: `${doc.id}#${i}`, docId: doc.id, text: chunks[i], embedding: emb });
    }
    const t1 = performance.now();
    indexTimes.push(t1 - t0);
  }
  fs.writeFileSync(VECTOR_STORE_FILE, JSON.stringify(index, null, 2));

  const avgIndexMs = indexTimes.reduce((s, v) => s + v, 0) / indexTimes.length;
  const medianIndexMs = indexTimes.slice().sort((a, b) => a - b)[Math.floor(indexTimes.length / 2)];

  // Retrieval eval
  const pAt1 = [];
  const pAt3 = [];
  const hit3 = [];
  for (const q of queries) {
    const qEmb = await embed(q.q);
    const scoresByDoc = new Map();
    for (const item of index) {
      const s = cosine(qEmb, item.embedding);
      const prev = scoresByDoc.get(item.docId) ?? -Infinity;
      if (s > prev) scoresByDoc.set(item.docId, s);
    }
    const ranked = Array.from(scoresByDoc.entries()).sort((a, b) => b[1] - a[1]).map((r) => r[0]);
    const top1 = ranked.slice(0, 1);
    const top3 = ranked.slice(0, TOP_K);
    const relevant = new Set(q.relevant);
    pAt1.push(top1.filter((d) => relevant.has(d)).length / 1);
    pAt3.push(top3.filter((d) => relevant.has(d)).length / TOP_K);
    hit3.push(top3.some((d) => relevant.has(d)) ? 1 : 0);
  }

  const out = {
    useRealEmbedding,
    indexing: {
      docsIndexed: docs.length,
      totalChunks: index.length,
      avgIndexMsPerDoc: Number(avgIndexMs.toFixed(3)),
      medianIndexMsPerDoc: Number(medianIndexMs.toFixed(3)),
    },
    retrieval: {
      queries: queries.length,
      precisionAt1: Number((pAt1.reduce((s, v) => s + v, 0) / pAt1.length * 100).toFixed(2)),
      precisionAt3: Number((pAt3.reduce((s, v) => s + v, 0) / pAt3.length * 100).toFixed(2)),
      hitRateAt3: Number((hit3.reduce((s, v) => s + v, 0) / hit3.length * 100).toFixed(2)),
    },
    vectorStoreFile: VECTOR_STORE_FILE,
  };

  console.log('MUN_BENCHMARK_RESULTS_START');
  console.log(JSON.stringify(out, null, 2));
  console.log('MUN_BENCHMARK_RESULTS_END');
}

run().catch((err) => {
  console.error('MUN benchmark failed:', err);
  process.exit(1);
});
