import { z } from 'zod';
import { HttpError } from './security.js';

export const reviewRequestSchema = z.object({
  project_id: z.string().uuid().optional(),
  version: z.number().int().min(1).default(1),
  html: z.string().min(10).max(500000)
}).strict();

/**
 * Hĺbková statická analýza HTML kódu generovaného v Trinity AI Studio.
 * Kontroluje prístupnosť (a11y), bezpečnosť (CSP/links), výkon (payload) a SEO.
 */
export function auditHtmlQuality(html) {
  const issues = [];
  const passed = [];
  const cleanHtml = String(html || '');
  const lower = cleanHtml.toLowerCase();

  // 1. Accessibility & Document Structure
  if (lower.includes('<!doctype html>')) passed.push('HTML5 doctype deklarovaný.');
  else issues.push({ id: 'doctype_missing', severity: 'high', category: 'a11y', message: 'Chýba deklarácia <!doctype html>.' });

  if (/<html[^>]*\blang=["'][a-z]{2,5}["']/i.test(cleanHtml)) passed.push('Atribút lang na <html> je definovaný.');
  else issues.push({ id: 'lang_missing', severity: 'medium', category: 'a11y', message: 'Chýba atribút lang na značke <html>.' });

  if (/<title>[^<]+<\/title>/i.test(cleanHtml)) passed.push('Značka <title> je prítomná a neprázdna.');
  else issues.push({ id: 'title_missing', severity: 'high', category: 'seo', message: 'Chýba alebo je prázdny tag <title>.' });

  if (/<meta[^>]*name=["']viewport["'][^>]*content=/i.test(cleanHtml)) passed.push('Responzívny meta viewport je nakonfigurovaný.');
  else issues.push({ id: 'viewport_missing', severity: 'high', category: 'performance', message: 'Chýba responzívny tag <meta name="viewport">.' });

  // Images without alt
  const imgMatches = cleanHtml.match(/<img\b(?![^>]*\balt=)[^>]*>/gi) || [];
  if (imgMatches.length === 0) passed.push('Všetky obrázky majú definovaný alt atribút.');
  else issues.push({ id: 'img_alt_missing', severity: 'medium', category: 'a11y', message: `Nájdených ${imgMatches.length} obrázkov bez atribútu alt.` });

  // Heading hierarchy
  if (/<h1\b/i.test(cleanHtml)) passed.push('Hlavný nadpis <h1> je prítomný.');
  else issues.push({ id: 'h1_missing', severity: 'medium', category: 'seo', message: 'Na stránke chýba primárny nadpis <h1>.' });

  // 2. Security & Best Practices
  if (/content-security-policy/i.test(cleanHtml)) passed.push('Content-Security-Policy (CSP) ochrana je aktívna.');
  else issues.push({ id: 'csp_missing', severity: 'high', category: 'security', message: 'Chýba Content-Security-Policy (CSP) meta tag.' });

  const targetBlankUnsafe = cleanHtml.match(/<a\b[^>]*\btarget=["']_blank["'](?![^>]*\brel=["'][^"']*noopener)[^>]*>/gi) || [];
  if (targetBlankUnsafe.length === 0) passed.push('Odkazy s target="_blank" bezpečne používajú rel="noopener".');
  else issues.push({ id: 'target_blank_unsafe', severity: 'medium', category: 'security', message: `Nájdených ${targetBlankUnsafe.length} odkazov s target="_blank" bez rel="noopener".` });

  if (!cleanHtml.includes('http://')) passed.push('Všetky zdroje a odkazy používajú výhradne zabezpečený HTTPS protokol.');
  else issues.push({ id: 'insecure_http', severity: 'medium', category: 'security', message: 'Boli nájdené nezabezpečené HTTP odkazy (Mixed Content riziko).' });

  // 3. Performance & Sizing
  const byteSize = Buffer.byteLength(cleanHtml, 'utf8');
  if (byteSize < 120000) passed.push(`Optimalizovaná veľkosť HTML kódu (${(byteSize / 1024).toFixed(1)} kB < 120 kB).`);
  else issues.push({ id: 'payload_too_large', severity: 'low', category: 'performance', message: `Veľký HTML dokument (${(byteSize / 1024).toFixed(1)} kB); zvážte kompresiu CSS.` });

  // 4. Score Calculation (0-100)
  const calcScore = (cat) => {
    const catIssues = issues.filter(i => i.category === cat);
    let penalty = 0;
    for (const i of catIssues) {
      if (i.severity === 'high') penalty += 20;
      else if (i.severity === 'medium') penalty += 10;
      else penalty += 5;
    }
    return Math.max(50, 100 - penalty);
  };

  const scores = {
    performance: calcScore('performance'),
    accessibility: calcScore('a11y'),
    best_practices: calcScore('security'),
    seo: calcScore('seo')
  };

  // 5. Automated Unit Test Generation (Playwright / Assertions)
  const titleMatch = cleanHtml.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Document';
  const hasForm = /<form\b/i.test(cleanHtml);
  const hasButton = /<button\b/i.test(cleanHtml);

  const generatedTests = [
    {
      name: 'Verify Page Title & Meta Viewport',
      code: `test('has expected title', async ({ page }) => {\n  await expect(page).toHaveTitle(/${title.slice(0, 30).replace(/[[\]\\]/g, '')}/);\n  const viewport = await page.locator('meta[name="viewport"]');\n  await expect(viewport).toHaveCount(1);\n});`
    },
    {
      name: 'Accessibility A11y Smoke Test',
      code: `test('passes basic a11y checks', async ({ page }) => {\n  const imagesWithoutAlt = await page.locator('img:not([alt])').count();\n  expect(imagesWithoutAlt).toBe(0);\n  const h1Count = await page.locator('h1').count();\n  expect(h1Count).toBeGreaterThanOrEqual(1);\n});`
    }
  ];

  if (hasButton) {
    generatedTests.push({
      name: 'Interactive Elements Smoke Test',
      code: `test('buttons are clickable and visible', async ({ page }) => {\n  const buttons = page.locator('button');\n  const count = await buttons.count();\n  expect(count).toBeGreaterThan(0);\n  await expect(buttons.first()).toBeVisible();\n});`
    });
  }

  if (hasForm) {
    generatedTests.push({
      name: 'Form Inputs Accessibility Test',
      code: `test('inputs have labels or aria-labels', async ({ page }) => {\n  const inputs = page.locator('input:not([type="hidden"])');\n  const count = await inputs.count();\n  for (let i = 0; i < count; i++) {\n    const aria = await inputs.nth(i).getAttribute('aria-label');\n    const id = await inputs.nth(i).getAttribute('id');\n    expect(Boolean(aria || id)).toBe(true);\n  }\n});`
    });
  }

  const generatedTestsSuite = `import { test, expect } from '@playwright/test';\n\ntest.describe('AI Studio Quality Smoke Suite', () => {\n` +
    generatedTests.map(t => `  // ${t.name}\n  ${t.code.split('\n').join('\n  ')}`).join('\n\n') +
    `\n});`;

  return {
    scores,
    score_performance: scores.performance,
    score_accessibility: scores.accessibility,
    score_best_practices: scores.best_practices,
    score_seo: scores.seo,
    overall_score: Math.round((scores.performance + scores.accessibility + scores.best_practices + scores.seo) / 4),
    issues,
    passed_checks: passed,
    generated_tests: generatedTestsSuite,
    test_cases: generatedTests,
    audited_at: new Date().toISOString()
  };
}

/**
 * Uloží výsledok auditu pre konkrétny projekt v D1
 */
export async function recordStudioReview(env, projectId, version, review) {
  if (!env.DB) return review;
  const id = `rev-${crypto.randomUUID()}`;
  await env.DB.prepare(`
    INSERT INTO studio_code_reviews(
      id, project_id, version, score_performance, score_accessibility,
      score_best_practices, score_seo, issues_json, passed_checks_json, generated_tests_json
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    projectId,
    version,
    review.scores.performance,
    review.scores.accessibility,
    review.scores.best_practices,
    review.scores.seo,
    JSON.stringify(review.issues || []),
    JSON.stringify(review.passed_checks || []),
    JSON.stringify(review.generated_tests || [])
  ).run().catch(() => {});

  return { ...review, review_id: id };
}
