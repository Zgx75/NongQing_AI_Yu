import { GeminiAIProvider } from "./gemini-provider";
import { MockAIProvider } from "./mock-provider";

export function getAIProvider() { return process.env.AI_PROVIDER === "gemini" ? new GeminiAIProvider() : new MockAIProvider(); }
