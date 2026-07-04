import { cognee } from '../lib/cognee';
import { ChatSession, ChatMessage } from 'openclaw';
import crypto from 'crypto';

const DATASET_ID = 'chat_sessions';

export class ChatSessionService {
  /**
   * Creates a new chat session.
   * Generates a unique chatId and inserts a default "New Chat" record in Cognee.
   */
  public static async createChat(): Promise<{ chatId: string; title: string }> {
    const chatId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newSession: ChatSession = {
      chatId,
      title: 'New Chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };

    await cognee.remember({
      datasetId: DATASET_ID,
      node: newSession,
    });

    console.log(`[ChatSessionService] Chat session created: ${chatId}`);
    return {
      chatId,
      title: newSession.title,
    };
  }

  /**
   * Retrieves all chat sessions from Cognee, ordered by latest updated.
   */
  public static async getChats(): Promise<any[]> {
    const results = await cognee.recall(DATASET_ID);
    if (!results || !Array.isArray(results)) {
      return [];
    }

    // Filter duplicates keeping the latest version for each chatId
    const uniqueChats = new Map<string, any>();
    for (const session of results) {
      if (!session || !session.chatId) continue;
      const existing = uniqueChats.get(session.chatId);
      if (!existing || new Date(session.updatedAt || session.createdAt).getTime() > new Date(existing.updatedAt || existing.createdAt).getTime()) {
        uniqueChats.set(session.chatId, session);
      }
    }

    return Array.from(uniqueChats.values())
      .map((session: any) => {
        const lastMsg = session.messages && session.messages.length > 0
          ? session.messages[session.messages.length - 1]
          : null;
        
        return {
          chatId: session.chatId,
          title: session.title,
          updatedAt: session.updatedAt || session.createdAt,
          lastMessagePreview: lastMsg
            ? lastMsg.content.substring(0, 100)
            : 'No messages yet',
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Retrieves a single chat session by ID.
   */
  public static async getChat(chatId: string): Promise<ChatSession | null> {
    const results = await cognee.recall(chatId);
    if (!results || !Array.isArray(results) || results.length === 0) {
      return null;
    }
    // Filter and sort to find the latest version
    const matches = results
      .filter((node: any) => node && node.chatId === chatId)
      .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return matches.length > 0 ? (matches[0] as ChatSession) : null;
  }

  /**
   * Deletes a chat session by ID.
   */
  public static async deleteChat(chatId: string): Promise<boolean> {
    await cognee.forget({
      datasetId: DATASET_ID,
      chatId,
    });

    console.log(`[ChatSessionService] Chat session deleted: ${chatId}`);
    return true;
  }

  /**
   * Appends a message to a specific chat session and saves it.
   */
  public static async appendMessage(chatId: string, message: ChatMessage): Promise<void> {
    const session = await this.getChat(chatId);
    if (!session) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    await cognee.remember({
      datasetId: DATASET_ID,
      node: session,
    });

    console.log(`[ChatSessionService] Message appended to chat ${chatId}: role=${message.role}`);
  }

  /**
   * Renames a chat session.
   */
  public static async renameChat(chatId: string, title: string): Promise<void> {
    const session = await this.getChat(chatId);
    if (!session) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    session.title = title;
    session.updatedAt = new Date().toISOString();

    await cognee.remember({
      datasetId: DATASET_ID,
      node: session,
    });

    console.log(`[ChatSessionService] Chat ${chatId} renamed to: "${title}"`);
  }

  /**
   * Saves the session state directly, avoiding redundant database reads.
   */
  public static async saveSession(session: ChatSession): Promise<void> {
    await cognee.remember({
      datasetId: DATASET_ID,
      node: session,
    });
    console.log(`[ChatSessionService] Direct save completed for session: ${session.chatId}`);
  }
}
