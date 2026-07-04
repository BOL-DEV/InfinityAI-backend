import { cognee } from '../lib/cognee';
import { MemoryNode, SearchResult } from 'openclaw';

const DATASET_ID = 'research_memory';

export class MemoryService {
  /**
   * Saves a webpage memory node to Cognee.
   */
  public static async ingestMemory(
    url: string,
    title: string,
    content: string,
    timestamp: string
  ): Promise<any> {
    const node: MemoryNode = {
      url,
      title,
      content,
      timestamp,
    };
    return await cognee.remember({
      datasetId: DATASET_ID,
      node,
    });
  }

  /**
   * Retrieves matching memories from Cognee.
   */
  public static async searchMemory(query: string): Promise<SearchResult[]> {
    return await cognee.recall(query);
  }

  /**
   * Removes a memory from Cognee.
   */
  public static async forgetMemory(url: string): Promise<any> {
    return await cognee.forget({
      datasetId: DATASET_ID,
      url,
    });
  }
}
