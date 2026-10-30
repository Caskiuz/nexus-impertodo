const DEFAULT_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`{1,3}/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .trim();
}

export interface GeminiResult {
  text: string | null;
  mode: 'gemini' | 'fallback';
  reason?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function askGemini(system: string, userText: string, maxTokens = 900): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { text: null, mode: 'fallback', reason: 'no-key' };

  const primary = process.env.GEMINI_TEXT_MODEL || DEFAULT_MODEL;

  async function request(model: string): Promise<Response> {
    const generationConfig: Record<string, unknown> = { temperature: 0.3, maxOutputTokens: maxTokens };
    // thinkingConfig solo es válido en gemini-2.5-flash; otros modelos lo rechazan con 400.
    if (model.startsWith('gemini-2.5-flash')) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n${userText}` }] }],
        generationConfig
      })
    });
  }

  // Gemini puede responder 429/5xx por cuota o saturación momentánea:
  // reintenta con espera creciente y, al final, cambia a un modelo alterno.
  const attempts = [
    { model: primary, wait: 0 },
    { model: primary, wait: 1500 },
    { model: FALLBACK_MODEL, wait: 2500 }
  ];

  let lastStatus = 0;

  for (const attempt of attempts) {
    if (attempt.wait) await sleep(attempt.wait);
    try {
      const res = await request(attempt.model);
      if (res.ok) {
        const json = await res.json();
        const parts = json.candidates?.[0]?.content?.parts || [];
        const raw = parts
          .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
          .map((p: { text: string }) => p.text)
          .join('')
          .trim();

        const clean = stripMarkdown(raw);
        if (clean) return { text: clean, mode: 'gemini' };
        lastStatus = 0;
        continue;
      }

      lastStatus = res.status;
      if (res.status !== 429 && res.status < 500) {
        return { text: null, mode: 'fallback', reason: `http-${res.status}` };
      }
    } catch {
      lastStatus = 0;
    }
  }

  return { text: null, mode: 'fallback', reason: lastStatus ? `http-${lastStatus}` : 'network' };
}
