import test from 'node:test';
import assert from 'node:assert/strict';
import { auditHtmlQuality } from '../src/studio-review.js';
import { getGraphVisualization, queryGraphContext } from '../src/graph-memory.js';

test('Pillar 1: Studio Code Review audits HTML structure, security and generates tests', () => {
  const goodHtml = `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Auru Cloud Platform</title>
</head>
<body>
  <header><h1>Auru Cloud</h1></header>
  <main>
    <img src="https://auru.space/logo.png" alt="Auru Logo">
    <a href="https://auru.space" target="_blank" rel="noopener noreferrer">Vstúpiť</a>
  </main>
</body>
</html>`;

  const review = auditHtmlQuality(goodHtml);
  assert.equal(typeof review.score_performance, 'number');
  assert.equal(typeof review.score_accessibility, 'number');
  assert.equal(typeof review.score_best_practices, 'number');
  assert.equal(typeof review.score_seo, 'number');
  assert.ok(review.score_accessibility >= 90, 'Accessibility score should be high for valid markup');
  assert.ok(review.score_seo >= 90, 'SEO score should be high when title and viewport are present');
  assert.ok(review.passed_checks.length > 0, 'Should have passed checks');
  assert.ok(review.generated_tests.includes('@playwright/test'), 'Generated tests should use Playwright');
  assert.ok(review.generated_tests.includes('Auru Cloud Platform'), 'Generated tests should test page title');
});

test('Pillar 1: Studio Code Review catches issues on poor HTML', () => {
  const poorHtml = `<div><h2>Missing title and doctype</h2><img src="test.jpg"><a href="http://insecure.site">Bad link</a></div>`;
  const review = auditHtmlQuality(poorHtml);
  assert.ok(review.score_accessibility < 100);
  assert.ok(review.score_seo < 100);
  assert.ok(review.issues.some(i => i.id === 'doctype_missing'));
  assert.ok(review.issues.some(i => i.id === 'title_missing'));
  assert.ok(review.issues.some(i => i.id === 'insecure_http'));
  assert.ok(review.issues.some(i => i.id === 'img_alt_missing'));
});

test('Pillar 1: Graph RAG visualization and context query handle empty/mock database', async () => {
  const mockDb = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              return { results: [] };
            },
            async run() {
              return { success: true };
            }
          };
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        }
      };
    }
  };

  const env = { DB: mockDb };
  const viz = await getGraphVisualization(env);
  assert.equal(viz.success, true);
  assert.equal(Array.isArray(viz.nodes), true);
  assert.equal(Array.isArray(viz.edges), true);

  const context = await queryGraphContext(env, 'test query');
  assert.equal(typeof context, 'object');
  assert.equal(Array.isArray(context.matched_nodes), true);
  assert.equal(typeof (context.formatted_context || ''), 'string');
});
