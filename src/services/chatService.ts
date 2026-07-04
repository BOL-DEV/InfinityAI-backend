import { MemoryService } from './memoryService';
import { GroqService } from './groqService';
import { SearchResult, ChatMessage } from 'openclaw';
import { ChatSessionService } from './chatSessionService';
import { z } from 'zod';
import crypto from 'crypto';

export interface ChatSource {
  title: string;
  url: string;
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

const aiResponseSchema = z.object({
  title: z.string().optional().nullable(),
  answer: z.string(),
  sourceSummary: z.array(z.string()).optional(),
});

export class ChatService {
  /**
   * Orchestrates the RAG flow:
   * 1. Loads chat session history.
   * 2. Retrieves context memories.
   * 3. Calls Groq completions in JSON mode.
   * 4. Updates session logs and generated title in Cognee.
   * 5. Returns final answers and source objects.
   */
  public static async processChat(
    chatId: string,
    message: string
  ): Promise<ChatResponse> {
    // 1. Retrieve the active session
    const session = await ChatSessionService.getChat(chatId);
    if (!session) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    const isFirstMessage = session.messages.length === 0;

    // 2. Search relevant memories matching query
    const memories = await MemoryService.searchMemory(message);
    // Limit to top 1 context document (the single most relevant match) for absolute focus
    const relevantMemories = memories.slice(0, 1);

    // 3. Construct 3-part context prompt
    const prompt = this.buildPrompt(message, relevantMemories, session.messages, isFirstMessage);

    // 4. Configure Groq JSON format system instructions
    const systemPrompt = `
You are a highly detailed and comprehensive research assistant. Use only the provided context to answer. 

You MUST respond in valid JSON format matching the following schema:
{
  "title": string | null, // If requested, generate a concise title (3-6 words, Title Case, no punctuation, no generic names like "AI Chat" or "New Chat") based on the topic of conversation. Otherwise, set to null.
  "answer": string, // Your answer. Provide a detailed, highly comprehensive explanation, step-by-step tutorials, code blocks, or formatting lists based strictly on the provided context. Cite sources (e.g. [1]) clearly.
  "sourceSummary": string[] // Short names/domains of cited sources.
}

Ensure that the JSON is fully valid, parses without errors, and details the concepts thoroughly without brief summaries.
`;

    // 5. Query Groq LLM
    const responseContent = await GroqService.generateChatResponse(prompt, systemPrompt, true);
    
    // 6. Safely parse and validate LLM output
    let aiResponse;
    try {
      const parsed = JSON.parse(responseContent);
      aiResponse = aiResponseSchema.parse(parsed);
    } catch (err) {
      console.error('[ChatService] Groq JSON parsing or Zod validation failed:', err);
      aiResponse = {
        title: null,
        answer: responseContent,
        sourceSummary: [],
      };
    }

    const formattedSources = relevantMemories.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content.length > 300 
        ? `${item.content.substring(0, 300)}...` 
        : item.content,
    }));

    // 7. Save conversation elements in Cognee
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: aiResponse.answer,
      timestamp: new Date().toISOString(),
      sources: formattedSources,
    };

    // Append both messages directly to local session memory
    session.messages.push(userMsg);
    session.messages.push(assistantMsg);
    session.updatedAt = new Date().toISOString();

    // Rename chat dynamically on first message in-memory
    if (isFirstMessage && aiResponse.title && aiResponse.title.trim() !== '') {
      const cleanTitle = aiResponse.title.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
      session.title = cleanTitle;
      console.log(`[ChatService] Title generated in-memory: "${cleanTitle}"`);
    }

    // Save session in a single database call, bypassing 12+ redundant network requests
    await ChatSessionService.saveSession(session);

    console.log(`[ChatService] AI response generated for chat ${chatId}`);

    return {
      answer: aiResponse.answer,
      sources: formattedSources,
    };
  }

  /**
   * Construct 3-part context prompt with safety truncations.
   */
  private static buildPrompt(
    message: string,
    context: SearchResult[],
    history: ChatMessage[],
    isFirstMessage: boolean
  ): string {
    const historyBlock = history
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    const contextBlock = context
      .map((item, index) => {
        const truncatedContent = item.content.length > 2500 
          ? `${item.content.substring(0, 2500)}...` 
          : item.content;
        return `[Source ${index + 1}] Title: "${item.title}" | Link: ${item.url}\nContent preview:\n${truncatedContent}`;
      })
      .join('\n\n---\n\n');

    return `
=== Conversation History ===
${historyBlock || 'No previous messages.'}

=== Knowledge Context ===
${contextBlock || 'No relevant knowledge context found.'}

=== Current User Message ===
${message}

Instructions:
Answer the Current User Message using the Conversation History and Knowledge Context above.
${
  isFirstMessage
    ? 'Since this is the first message, you MUST generate a concise title (3-6 words, Title Case, no generic terms, no punctuation) summarizing this topic and put it in the "title" JSON field.'
    : 'Do not generate a title; set "title" to null.'
}
`;
  }
}
