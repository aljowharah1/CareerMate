// src/agents/BaseAgent.ts

import type { AgentRole, AgentMessage } from "./types";

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/free";

// Free models on OpenRouter have a token limit — keep this at 1000
const MAX_TOKENS = 1000;

function getKey(): string {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!key) {
    throw new Error(
      "VITE_OPENROUTER_API_KEY is missing. " +
      "Make sure your .env file is in the root of the project and contains: " +
      "VITE_OPENROUTER_API_KEY=sk-or-..."
    );
  }
  return key;
}

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getKey()}`,
    "HTTP-Referer": "https://fursa.app",
    "X-Title": "FURSA CareerMate",
  };
}

export abstract class BaseAgent {
  readonly role: AgentRole;
  protected systemPrompt: string;
  public messageLog: AgentMessage[] = [];

  constructor(role: AgentRole, systemPrompt: string) {
    this.role = role;
    this.systemPrompt = systemPrompt;
  }

  // Standard text call
  protected async callLLM(userMessage: string): Promise<string> {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`${this.role}: ${data.error?.message ?? "API error"}`);
    return data.choices[0].message.content as string;
  }

  // Call with base64 PDF (CV or cover letter)
  protected async callLLMWithPDF(
    userMessage: string,
    base64PDF: string
  ): Promise<string> {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: this.systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              {
                type: "file",
                file: {
                  filename: "document.pdf",
                  file_data: `data:application/pdf;base64,${base64PDF}`,
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`${this.role}: ${data.error?.message ?? "API error"}`);
    return data.choices[0].message.content as string;
  }

  // Parse JSON safely from LLM response
  protected parseJSON<T>(raw: string, fallback: T): T {
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      return JSON.parse(clean) as T;
    } catch {
      return fallback;
    }
  }

  protected log(to: AgentMessage["to"], content: string) {
    this.messageLog.push({ from: this.role, to, content, timestamp: new Date() });
  }

  abstract run(input: string, context?: Record<string, unknown>): Promise<string>;
}