import {z} from 'zod';

// Public chat options are deliberately separate from internal execution options.
export const copilotChatOptionsSchema=z.object({
  noCache:z.boolean().optional(),
  aiProvider:z.enum(['workers-ai','gemini','openai','ollama']).optional(),
  maxTokens:z.number().int().min(1).max(4096).optional(),
  enableFallback:z.boolean().optional()
}).strict();
