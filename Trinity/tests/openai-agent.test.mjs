import test from "node:test";
import assert from "node:assert/strict";
import { extractOpenAIText, openAIConfigured } from "../src/openai-agent.js";

test("openAIConfigured only reports configured when a key exists", () => {
  assert.equal(openAIConfigured({}), false);
  assert.equal(openAIConfigured({ OPENAI_API_KEY: "test-key" }), true);
});

test("extractOpenAIText supports output_text", () => {
  assert.equal(extractOpenAIText({ output_text: "Ahoj Trinity" }), "Ahoj Trinity");
});

test("extractOpenAIText supports Responses API output blocks", () => {
  const result = extractOpenAIText({
    output: [
      { content: [{ type: "output_text", text: "Prva" }] },
      { content: [{ type: "output_text", text: "Druha" }] },
    ],
  });
  assert.equal(result, "Prva\nDruha");
});
