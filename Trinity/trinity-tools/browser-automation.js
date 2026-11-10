/**
 * Trinity Browser Automation Module
 * ───────────────────────────────────
 * Uses Cloudflare Browser Rendering (@cloudflare/puppeteer) to provide
 * headless Chromium automation from the Worker edge.
 *
 * This module handles legitimate web automation:
 *   - Page navigation and scraping
 *   - Screenshot capture
 *   - Form interaction
 *   - Content extraction
 *
 * For the PC_BRIDGE_SERVICE service binding, the Worker forwards browser
 * requests here. For local-browser tasks (where datacenter IPs are blocked),
 * the request is routed to the PC Bridge daemon instead, which uses the
 * user's local Chrome/Edge with their existing profile.
 *
 * IMPORTANT: This module does NOT automate social media login flows that
 * circumvent platform bot detection. Use official APIs (Meta Graph API,
 * X API v2, Reddit API) for authenticated platform interactions.
 */

import puppeteer from '@cloudflare/puppeteer';

// ── Browser session manager ──────────────────────────────────────────
export class BrowserSession {
  constructor(env) {
    this.env = env;
    this.browser = null;
  }

  async open() {
    this.browser = await puppeteer.launch(this.env.BROWSER);
    return this;
  }

  async close() {
    if (this.browser) await this.browser.close();
    this.browser = null;
  }

  async newPage() {
    if (!this.browser) await this.open();
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    return page;
  }
}

// ── Actions ──────────────────────────────────────────────────────────

/**
 * Navigate to a URL and return page metadata.
 */
export async function navigate(env, { url, waitUntil = 'networkidle0' }) {
  const session = new BrowserSession(env);
  try {
    const page = await session.newPage();
    await page.goto(url, { waitUntil, timeout: 30000 });
    const title = await page.title();
    const finalUrl = page.url();
    return { status: 'SUCCESS', title, url: finalUrl };
  } finally {
    await session.close();
  }
}

/**
 * Capture a screenshot and store in R2.
 */
export async function screenshot(env, { url, fullPage = false, r2Key }) {
  const session = new BrowserSession(env);
  try {
    const page = await session.newPage();
    if (url) await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    const screenshot = await page.screenshot({ type: 'png', fullPage });

    const key = r2Key || `screenshots/${Date.now()}.png`;
    const bucket = env.R2 || env.ARTIFACTS || env.TRINITY_STORAGE;
    if (bucket) {
      await bucket.put(key, screenshot, { httpMetadata: { contentType: 'image/png' } });
    }

    return {
      status: 'SUCCESS',
      r2_key: key,
      size: screenshot.byteLength,
    };
  } finally {
    await session.close();
  }
}

/**
 * Scrape visible text content from a page.
 */
export async function scrape(env, { url, selector = 'body', maxLength = 10000 }) {
  const session = new BrowserSession(env);
  try {
    const page = await session.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    const text = await page.$eval(selector, el => el.textContent || '');
    return { status: 'SUCCESS', content: text.slice(0, maxLength) };
  } finally {
    await session.close();
  }
}

/**
 * Extract structured data using a CSS selector.
 */
export async function extract(env, { url, selector, attribute = 'textContent' }) {
  const session = new BrowserSession(env);
  try {
    const page = await session.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    const elements = await page.$$(selector);
    const results = [];
    for (const el of elements) {
      const value = attribute === 'textContent'
        ? await el.evaluate(node => node.textContent?.trim())
        : await el.evaluate((node, attr) => node.getAttribute(attr), attribute);
      results.push(value);
    }
    return { status: 'SUCCESS', results };
  } finally {
    await session.close();
  }
}

/**
 * Fill and submit a form (generic, not for social media auth).
 */
export async function fillForm(env, { url, fields, submitSelector }) {
  const session = new BrowserSession(env);
  try {
    const page = await session.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    for (const field of fields) {
      await page.waitForSelector(field.selector, { timeout: 5000 });
      await page.click(field.selector, { clickCount: 3 }); // select all
      await page.type(field.selector, field.value);
    }

    if (submitSelector) {
      await page.click(submitSelector);
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    }

    return {
      status: 'SUCCESS',
      finalUrl: page.url(),
      title: await page.title(),
    };
  } finally {
    await session.close();
  }
}

/**
 * Click an element on a page.
 */
export async function click(env, { url, selector, waitAfter = 2000 }) {
  const session = new BrowserSession(env);
  try {
    const page = await session.newPage();
    if (url) await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    await page.waitForTimeout(waitAfter);
    return { status: 'SUCCESS', finalUrl: page.url() };
  } finally {
    await session.close();
  }
}

// ── Router: maps action names to functions ───────────────────────────
export const BROWSER_ACTIONS = {
  navigate: navigate,
  screenshot: screenshot,
  scrape: scrape,
  extract: extract,
  fill_form: fillForm,
  click: click,
};

/**
 * Main entry point — called by the tool-calling engine.
 */
export async function executeBrowserAction(env, action, args) {
  const handler = BROWSER_ACTIONS[action];
  if (!handler) {
    return { status: 'ERROR', message: `Unknown browser action: ${action}` };
  }
  return handler(env, args);
}
