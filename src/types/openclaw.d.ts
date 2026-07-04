declare module 'openclaw' {
  export interface MemoryNode {
    url: string;
    title: string;
    content: string;
    timestamp: string;
  }

  export interface SearchResult {
    url: string;
    title: string;
    content: string;
    score?: number;
  }

  export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    sources?: any[];
  }

  export interface ChatSession {
    chatId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: ChatMessage[];
  }

  export interface CogneeClient {
    remember(data: { datasetId: string; node: any }): Promise<any>;
    recall(query: string): Promise<any[]>;
    forget(data: { datasetId: string; url?: string; chatId?: string }): Promise<any>;
  }

  export const cognee: CogneeClient;
}
