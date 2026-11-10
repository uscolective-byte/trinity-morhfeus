/**
 * Trinity Stream Guard
 * Sliding-window SSE filter pre zachytávanie tokenov, leakov a kľúčov
 * @version 1.0.0
 */

// Patterny pre senzitívne dáta
const SENSITIVE_PATTERNS = [
  /(?:sk-|pk-|Bearer\s)[a-zA-Z0-9_-]{20,}/gi,        // API keys
  /(?:ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9]{36}/gi,    // GitHub tokens
  /(?:AKIA)[A-Z0-9]{16}/gi,                           // AWS keys
  /(?:-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)[\s\S]+?(?:-----END)/gi, // Private keys
  /(?:password|passwd|pwd|secret|token|api_key|apikey)\s*[:=]\s*\S+/gi, // Credentials
  /(?:xox[baprs]-)[a-zA-Z0-9-]+/gi,                   // Slack tokens
  /(?:AIza)[a-zA-Z0-9_-]{35}/gi,                      // Google API keys
  /(?:eyJ)[a-zA-Z0-9_-]+?\.[a-zA-Z0-9_-]+?\.[a-zA-Z0-9_-]+/gi, // JWT tokens
];

const REDACTION_TEXT = "[REDACTED]";

/**
 * Skontroluje text na senzitívne dáta
 */
export function scanForLeaks(text) {
  if (!text || typeof text !== "string") return { hasLeak: false, cleaned: text, matches: [] };
  const matches = [];
  let cleaned = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      matches.push({ pattern: pattern.source, count: m.length });
      cleaned = cleaned.replace(pattern, REDACTION_TEXT);
    }
  }
  return { hasLeak: matches.length > 0, cleaned, matches };
}

/**
 * Stream Guard — filtruje SSE streamy v reálnom čase
 */
export class StreamGuard {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 4096;  // Sliding window size
    this.buffer = "";
    this.totalScanned = 0;
    this.leaksDetected = 0;
  }

  /**
   * Spracuje chunk textu zo streamu
   * @returns {string} - očistený text
   */
  processChunk(chunk) {
    this.buffer += chunk;
    this.totalScanned += chunk.length;

    // Ak je buffer príliš krátky, počkaj na viac dát
    if (this.buffer.length < this.windowSize) {
      return "";
    }

    // Skontroluj buffer na leaky
    const { hasLeak, cleaned, matches } = scanForLeaks(this.buffer);
    if (hasLeak) {
      this.leaksDetected += matches.length;
      console.warn(`[StreamGuard] Detected ${matches.length} sensitive pattern(s) in stream`);
    }

    // Vráť očistený text a vyprázdni buffer
    const output = cleaned;
    this.buffer = "";
    return output;
  }

  /**
   * Flush zvyšku bufferu na konci streamu
   */
  flush() {
    if (this.buffer.length === 0) return "";
    const { cleaned, hasLeak } = scanForLeaks(this.buffer);
    if (hasLeak) this.leaksDetected++;
    const output = cleaned;
    this.buffer = "";
    return output;
  }

  /**
   * Vytvorí filtrovaný ReadableStream z Response
   */
  wrapStream(response) {
    const self = this;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    return new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            const remaining = self.flush();
            if (remaining) controller.enqueue(encoder.encode(remaining));
            controller.close();
            return;
          }
          const text = decoder.decode(value, { stream: true });
          const cleaned = self.processChunk(text);
          if (cleaned) controller.enqueue(encoder.encode(cleaned));
        } catch (e) {
          console.error("[StreamGuard] Stream error:", e.message);
          controller.error(e);
        }
      },
      cancel() {
        reader.cancel();
      }
    });
  }

  getStats() {
    return {
      totalScanned: this.totalScanned,
      leaksDetected: this.leaksDetected,
      bufferLength: this.buffer.length
    };
  }
}
