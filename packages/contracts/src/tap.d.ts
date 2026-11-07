import type { z } from 'zod';
export type TaskStatus = 'REQUESTED' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'VERIFIED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN_OUTCOME';
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface ToolExecutionReceipt {
  protocol: 'trinity.receipt.v1'; receipt_id: string; task_id: string; run_id: string;
  agent_id: string; tool_id: string; environment: 'local' | 'staging' | 'production';
  request_hash: string; result_hash: string; status: 'COMPLETED'; created_at: string; checksum: string;
}
export interface TrinityMessage {
  protocol: 'trinity.agent.v1'; contract_version: '1.0.0';
  message_id: string; trace_id: string; task_id: string; run_id: string;
  sender: { type: 'agent' | 'service'; id: string }; receiver: { type: 'agent' | 'service'; id: string };
  kind: 'task.request' | 'task.status' | 'task.result'; environment: 'local' | 'staging' | 'production';
  status: TaskStatus; authorization_ref: string; idempotency_key: string;
  payload: { objective: string; tool_id: string; arguments: Record<string, JsonValue>; constraints: string[]; acceptance_criteria: string[] };
  result: JsonValue; evidence: ToolExecutionReceipt[]; error: { code: string; message: string } | null;
}
export const PROTOCOL: 'trinity.agent.v1';
export const CONTRACT_VERSION: '1.0.0';
export const Status: z.ZodType<TaskStatus>;
export const MessageSchema: z.ZodType<TrinityMessage>;
export const ReceiptSchema: z.ZodType<ToolExecutionReceipt>;
export function transition(from: TaskStatus, to: TaskStatus): TaskStatus;
export function canonicalJson(value: JsonValue): string;
export function digest(value: unknown): Promise<string>;
export function createReceipt(message: TrinityMessage, result: JsonValue): Promise<ToolExecutionReceipt>;
export function verifyReceipt(receipt: unknown, request: TrinityMessage, result: JsonValue): Promise<boolean>;
export function fromLegacy(input: { agent_id: string; tool_id: string; arguments?: Record<string, JsonValue> }, context: { sender_id: string; environment: TrinityMessage['environment']; authorization_ref: string; idempotency_key: string; task_id?: string; run_id?: string; trace_id?: string; objective?: string }): TrinityMessage;
