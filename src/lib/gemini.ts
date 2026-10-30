const DEFAULT_MODEL = 'gemini-2.5-flash';

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

export async function askGemini(system: string, userText: string, maxTokens = 900): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { text: null, mode: 'fallback', reason: 'no-key' };

  const model = process.env.GEMINI_TEXT_MODEL || DEFAULT_MODEL;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${system}\n\n${userText}` }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxTokens,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    if (!res.ok) {
      return { text: null, mode: 'fallback', reason: res.status === 429 ? 'quota' : `http-${res.status}` };
    }

    const json = await res.json();
    const parts = json.candidates?.[0]?.content?.parts || [];
    const raw = parts
      .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join('')
      .trim();

    const clean = stripMarkdown(raw);
    return clean ? { text: clean, mode: 'gemini' } : { text: null, mode: 'fallback', reason: 'empty' };
  } catch {
    return { text: null, mode: 'fallback', reason: 'network' };
  }
}
