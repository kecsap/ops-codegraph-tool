#!/usr/bin/env node

/**
 * Embedding strategy benchmark — auto-generated from the graph.
 *
 * For every function/method/class in the graph, generates a natural language
 * query from the symbol name (e.g. buildGraph → "build graph") and checks
 * if the embedding search finds that symbol in the top N results.
 * No hand-picked queries — zero human bias, tests every symbol.
 *
 * Prerequisites:
 *   - @huggingface/transformers installed
 *   - codegraph build already run (graph.db exists)
 *
 * Usage:
 *   node tests/search/embedding-benchmark.js
 *   node tests/search/embedding-benchmark.js --model minilm
 *   node tests/search/embedding-benchmark.js --limit 50    # test first N symbols
 *   node tests/search/embedding-benchmark.js --no-tests    # exclude test files
 */

import path from 'node:path';
import Database from 'better-sqlite3';
import { buildEmbeddings, DEFAULT_MODEL, MODELS, searchData } from '../../src/embedder.js';

const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
};

const model = getArg('--model', DEFAULT_MODEL);
const symbolLimit = parseInt(getArg('--limit', '0'), 10);
const noTests = args.includes('--no-tests');
const TEST_PATTERN = /\.(test|spec)\.|__test__|__tests__|\.stories\./;

const rootDir = '.';
const dbPath = path.resolve('.codegraph/graph.db');

/**
 * Split an identifier into readable words (mirrors src/embedder.js splitIdentifier).
 */
function splitIdentifier(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Load all embeddable symbols from the graph and generate queries.
 */
function loadSymbols() {
  const db = new Database(dbPath, { readonly: true });
  let rows = db
    .prepare(
      `SELECT name, kind, file, line FROM nodes WHERE kind IN ('function', 'method', 'class') ORDER BY file, line`,
    )
    .all();
  db.close();

  if (noTests) {
    rows = rows.filter((r) => !TEST_PATTERN.test(r.file));
  }

  // Deduplicate by name (same name in different files → keep first)
  const seen = new Set();
  const symbols = [];
  for (const row of rows) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);

    const query = splitIdentifier(row.name);
    // Skip symbols with single-char or very short names (not meaningful queries)
    if (query.length < 4) continue;
    symbols.push({ name: row.name, kind: row.kind, file: row.file, query });
  }

  return symbolLimit > 0 ? symbols.slice(0, symbolLimit) : symbols;
}

async function benchmark(strategy, symbols) {
  await buildEmbeddings(rootDir, model, dbPath, { strategy });

  let hits1 = 0;
  let hits3 = 0;
  let hits5 = 0;
  let hits10 = 0;
  const misses = [];

  for (let i = 0; i < symbols.length; i++) {
    const { name, query } = symbols[i];
    const data = await searchData(query, dbPath, { minScore: 0.01, limit: 10 });
    if (!data) continue;

    const names = data.results.map((r) => r.name);
    const rank = names.indexOf(name) + 1; // 0 = not found

    if (rank === 1) hits1++;
    if (rank >= 1 && rank <= 3) hits3++;
    if (rank >= 1 && rank <= 5) hits5++;
    if (rank >= 1 && rank <= 10) hits10++;
    if (rank === 0) misses.push({ name, query, top: names[0] || '(none)' });

    if ((i + 1) % 25 === 0) {
      process.stdout.write(`  ${strategy}: ${i + 1}/${symbols.length}\r`);
    }
  }

  return { strategy, hits1, hits3, hits5, hits10, total: symbols.length, misses };
}

// ─── Main ──────────────────────────────────────────────────────────────

const modelConfig = MODELS[model];
const symbols = loadSymbols();

console.log('=== Embedding Strategy Benchmark (auto-generated) ===');
console.log(`Model: ${model} (${modelConfig.dim}d, ${modelConfig.contextWindow} token ctx)`);
console.log(`Symbols: ${symbols.length} unique (query = splitIdentifier of name)`);
console.log('');

const structured = await benchmark('structured', symbols);
console.log('');
const source = await benchmark('source', symbols);
console.log('');

// Summary
const pct = (n, t) => `${n}/${t} (${((n / t) * 100).toFixed(1)}%)`;
const delta = (a, b) => {
  const d = a - b;
  return d > 0 ? `+${d}` : String(d);
};

console.log('=== RESULTS ===');
console.log('');
console.log(`${'Metric'.padEnd(12)}${'structured'.padEnd(20)}${'source'.padEnd(20)}delta`);

for (const [label, key] of [
  ['Hit@1', 'hits1'],
  ['Hit@3', 'hits3'],
  ['Hit@5', 'hits5'],
  ['Hit@10', 'hits10'],
]) {
  console.log(
    `${label.padEnd(12)}${pct(structured[key], structured.total).padEnd(20)}${pct(source[key], source.total).padEnd(20)}${delta(structured[key], source[key])}`,
  );
}

console.log('');
console.log(`Misses: structured=${structured.misses.length}, source=${source.misses.length}`);

// Show misses unique to each strategy
const structMissNames = new Set(structured.misses.map((m) => m.name));
const sourceMissNames = new Set(source.misses.map((m) => m.name));
const onlyStructMiss = structured.misses.filter((m) => !sourceMissNames.has(m.name));
const onlySourceMiss = source.misses.filter((m) => !structMissNames.has(m.name));

if (onlySourceMiss.length > 0) {
  console.log(`\nStructured finds but source misses (${onlySourceMiss.length}):`);
  for (const m of onlySourceMiss.slice(0, 15)) {
    console.log(`  "${m.query}" → expected: ${m.name}, got: ${m.top}`);
  }
  if (onlySourceMiss.length > 15) console.log(`  ... and ${onlySourceMiss.length - 15} more`);
}

if (onlyStructMiss.length > 0) {
  console.log(`\nSource finds but structured misses (${onlyStructMiss.length}):`);
  for (const m of onlyStructMiss.slice(0, 15)) {
    console.log(`  "${m.query}" → expected: ${m.name}, got: ${m.top}`);
  }
  if (onlyStructMiss.length > 15) console.log(`  ... and ${onlyStructMiss.length - 15} more`);
}
