import Groq from 'groq-sdk';
import { env } from '../config/env';

const groq = new Groq({
  apiKey: env.GROQ_API_KEY,
});

export class GroqService {
  /**
   * Generates a chat completion response using Groq's Llama-3.1-8b-instant model.
   * Employs system message instructions, retries once on failure, and returns
   * a fallback message if generation remains unsuccessful.
   */
  public static async generateChatResponse(
    prompt: string,
    systemMessage?: string,
    jsonMode = false
  ): Promise<string> {
    const defaultSystem = 'You are a research assistant. Use only provided context. Always include citations when available.';
    const activeSystem = systemMessage || defaultSystem;

    let attempts = 0;
    while (attempts < 2) {
      try {
        const response = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: activeSystem,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          ...(jsonMode && { response_format: { type: 'json_object' } }),
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          return content;
        }
        throw new Error('Empty response content received from Groq completions');
      } catch (err) {
        attempts++;
        console.error(`[GroqService] Completion attempt ${attempts} failed:`, err);
        if (attempts >= 2) {
          if (jsonMode) {
            return JSON.stringify({
              title: null,
              answer: 'Unable to generate response at the moment.',
              sourceSummary: [],
            });
          }
          return 'Unable to generate response at the moment.';
        }
      }
    }
    return jsonMode
      ? JSON.stringify({
          title: null,
          answer: 'Unable to generate response at the moment.',
          sourceSummary: [],
        })
      : 'Unable to generate response at the moment.';
  }
}
