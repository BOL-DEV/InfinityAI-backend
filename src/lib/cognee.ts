const memoryStore: any[] = [];
const datasetUuidCache = new Map<string, string>();

const isPlaceholderKey = (key: string | undefined): boolean => {
  return !key || key === 'your_key_here' || key === 'placeholder';
};

// Tenant Specific Configurations
const COGNEE_BASE_URL = process.env.COGNEE_BASE_URL || 'https://tenant-53d6313c-82b7-4e3b-a44b-0cec14917ec8.aws.cognee.ai';
const COGNEE_TENANT_ID = '53d6313c-82b7-4e3b-a44b-0cec14917ec8';

export const cognee = {
  remember: async (data: { datasetId: string; node: any }) => {
    const apiKey = process.env.COGNEE_API_KEY;
    const { datasetId, node } = data;
    const isChat = datasetId === 'chat_sessions' || node.chatId !== undefined;
    const itemKey = isChat ? node.chatId : node.url;
    
    console.log(`[Cognee SDK Local] Ingesting memory for dataset ${datasetId}: ${itemKey}`);

    if (isPlaceholderKey(apiKey)) {
      console.log(`[Cognee SDK Local] COGNEE_API_KEY is placeholder. Using mock local memory storage.`);
      const index = memoryStore.findIndex(m => {
        if (isChat) {
          return m.chatId === node.chatId && m.datasetId === datasetId;
        }
        return m.url === node.url && m.datasetId === datasetId;
      });

      if (index !== -1) {
        memoryStore[index] = { ...node, datasetId };
      } else {
        memoryStore.push({ ...node, datasetId });
      }
      return { success: true, message: 'Memory stored in local mock' };
    }

    // Call real Cognee Tenant Cloud API using manual multipart/form-data formatting
    try {
      const boundary = '----NodeFetchBoundary' + Math.random().toString(36).substring(2);
      
      let payloadStr = '';
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(datasetId);
      if (isUuid) {
        payloadStr += '--' + boundary + '\r\n';
        payloadStr += 'Content-Disposition: form-data; name="datasetId"\r\n\r\n';
        payloadStr += datasetId + '\r\n';
      } else {
        payloadStr += '--' + boundary + '\r\n';
        payloadStr += 'Content-Disposition: form-data; name="datasetName"\r\n\r\n';
        payloadStr += datasetId + '\r\n';
      }
      
      // Determine a unique filename based on node identifier
      let filename = 'data.json';
      if (isChat && node.chatId) {
        filename = `chat_${node.chatId}.json`;
      } else if (node.url) {
        filename = `mem_${Buffer.from(node.url).toString('hex')}.json`;
      }

      const nodeContent = typeof node === 'string' ? node : JSON.stringify(node);
      payloadStr += '--' + boundary + '\r\n';
      payloadStr += `Content-Disposition: form-data; name="data"; filename="${filename}"\r\n`;
      payloadStr += 'Content-Type: application/json\r\n\r\n';
      payloadStr += nodeContent + '\r\n';
      payloadStr += '--' + boundary + '--\r\n';

      const payloadBuffer = Buffer.from(payloadStr, 'utf-8');

      const response = await fetch(`${COGNEE_BASE_URL}/api/v1/remember`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'X-Api-Key': apiKey || '',
          'X-Tenant-Id': COGNEE_TENANT_ID
        },
        body: payloadBuffer
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Cognee SDK Local] Real Cognee remember API failed: ${response.status} - ${errText}`);
        // Fallback to local memory store
        const index = memoryStore.findIndex(m => {
          if (isChat) {
            return m.chatId === node.chatId && m.datasetId === datasetId;
          }
          return m.url === node.url && m.datasetId === datasetId;
        });
        if (index !== -1) {
          memoryStore[index] = { ...node, datasetId };
        } else {
          memoryStore.push({ ...node, datasetId });
        }
        return { success: true, fallback: true, message: 'Memory stored locally after API error' };
      }

      return await response.json();
    } catch (err: any) {
      console.warn(`[Cognee SDK Local] Real Cognee remember API failed with network error: ${err.message}. Falling back to local memory store.`);
      const index = memoryStore.findIndex(m => {
        if (isChat) {
          return m.chatId === node.chatId && m.datasetId === datasetId;
        }
        return m.url === node.url && m.datasetId === datasetId;
      });
      if (index !== -1) {
        memoryStore[index] = { ...node, datasetId };
      } else {
        memoryStore.push({ ...node, datasetId });
      }
      return { success: true, fallback: true, message: 'Memory stored locally after API network error' };
    }
  },

  recall: async (query: string): Promise<any[]> => {
    const apiKey = process.env.COGNEE_API_KEY;
    console.log(`[Cognee SDK Local] Recalling memories for query: "${query}"`);

    const runLocalFallback = () => {
      if (query === 'chat_sessions' || query === 'chat_session') {
        return memoryStore.filter(node => node.datasetId === 'chat_sessions');
      }

      const matchById = memoryStore.find(node => node.chatId === query);
      if (matchById) {
        return [matchById];
      }

      const terms = query.toLowerCase().split(/\s+/);
      const matches = memoryStore.filter(node => {
        if (node.datasetId === 'chat_sessions') return false;
        const text = `${node.title} ${node.content}`.toLowerCase();
        return terms.some(term => text.includes(term));
      });
      return matches.map(node => ({
        url: node.url,
        title: node.title,
        content: node.content,
        score: 1.0
      }));
    };

    if (isPlaceholderKey(apiKey)) {
      console.log(`[Cognee SDK Local] COGNEE_API_KEY is placeholder. Performing local substring search.`);
      return runLocalFallback();
    }

    try {
      const isChatQuery = query === 'chat_sessions' || query === 'chat_session' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
      const targetName = isChatQuery ? 'chat_sessions' : 'research_memory';

      let targetDatasetId = datasetUuidCache.get(targetName);
      if (!targetDatasetId) {
        const listResp = await fetch(`${COGNEE_BASE_URL}/api/v1/datasets`, {
          method: 'GET',
          headers: {
            'X-Api-Key': apiKey || '',
            'X-Tenant-Id': COGNEE_TENANT_ID
          }
        });
        
        if (!listResp.ok) {
          throw new Error(`List datasets status ${listResp.status}`);
        }
        const datasets = await listResp.json() as any[];
        const targetDataset = datasets.find(d => d.name === targetName);
        if (targetDataset) {
          targetDatasetId = targetDataset.id;
          datasetUuidCache.set(targetName, targetDataset.id);
        }
      }

      if (!targetDatasetId) {
        return [];
      }
      
      const dataResp = await fetch(`${COGNEE_BASE_URL}/api/v1/datasets/${targetDatasetId}/data`, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey || '',
          'X-Tenant-Id': COGNEE_TENANT_ID
        }
      });
      
      if (!dataResp.ok) {
        throw new Error(`Get data items status ${dataResp.status}`);
      }
      const dataItems = await dataResp.json() as any[];
      if (!dataItems || !Array.isArray(dataItems)) {
        return [];
      }
      
      let filteredItems = dataItems;
      if (isChatQuery) {
        const queryIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
        if (queryIsUuid) {
          filteredItems = dataItems.filter(item => 
            item.name === `chat_${query}` || item.name === `chat_${query}.json` || item.name === 'data' || item.name === 'data.json'
          );
        } else {
          filteredItems = dataItems.filter(item => 
            item.name.startsWith('chat_') || item.name === 'data' || item.name === 'data.json'
          );
        }
      } else {
        filteredItems = dataItems.filter(item => 
          item.name.startsWith('mem_') || item.name === 'data' || item.name === 'data.json'
        );
      }

      const fetchRawContent = async (item: any) => {
        try {
          const rawResp = await fetch(`${COGNEE_BASE_URL}/api/v1/datasets/${targetDatasetId}/data/${item.id}/raw`, {
            method: 'GET',
            headers: {
              'X-Api-Key': apiKey || '',
              'X-Tenant-Id': COGNEE_TENANT_ID
            }
          });
          if (rawResp.ok) {
            const text = await rawResp.text();
            try {
              return JSON.parse(text);
            } catch (e) {
              return { content: text, title: item.name, url: 'cognee://' + item.id };
            }
          }
        } catch (err: any) {
          console.warn(`[Cognee SDK Local] Failed to download raw content for data item ${item.id}:`, err);
        }
        return null;
      };

      const parsedNodes: any[] = [];
      const batchLimit = 4;
      for (let i = 0; i < filteredItems.length; i += batchLimit) {
        const chunk = filteredItems.slice(i, i + batchLimit);
        const chunkResults = await Promise.all(chunk.map(fetchRawContent));
        parsedNodes.push(...chunkResults.filter(node => node !== null));
      }

      if (isChatQuery) {
        if (query !== 'chat_sessions' && query !== 'chat_session') {
          return parsedNodes.filter(node => node.chatId === query);
        }
        return parsedNodes;
      }
      
      // Filter webpage memories by query with weighted relevance scoring
      if (query && query !== 'a e i o u' && query.trim() !== '') {
        const stopWords = new Set([
          'the', 'to', 'on', 'how', 'just', 'is', 'a', 'an', 'and', 'or', 
          'in', 'of', 'for', 'with', 'about', 'at', 'by', 'from', 'into', 
          'it', 'this', 'that', 'these', 'those', 'you', 'i', 'my', 'me',
          'we', 'us', 'our', 'they', 'them', 'he', 'she', 'him', 'her', 'steps', 'step'
        ]);

        const rawTerms = query.toLowerCase().split(/[\s,.\-!?]+/);
        const searchTerms = rawTerms.filter(term => !stopWords.has(term) && term.length > 1);

        if (searchTerms.length === 0) {
          return parsedNodes;
        }

        const scoredNodes = parsedNodes
          .map(node => {
            let score = 0;
            const title = (node.title || '').toLowerCase();
            const content = (node.content || '').toLowerCase();

            for (const term of searchTerms) {
              if (title.includes(term)) {
                score += 15; // High weight for title match
              }
              // Count term occurrences in content
              const occurrences = content.split(term).length - 1;
              score += occurrences * 1;
            }

            return { node, score };
          })
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(item => item.node);

        return scoredNodes;
      }
      
      return parsedNodes;
    } catch (err: any) {
      console.warn(`[Cognee SDK Local] Real Cognee recall API failed: ${err.message}. Falling back to local search.`);
      return runLocalFallback();
    }
  },

  forget: async (data: { datasetId: string; url?: string; chatId?: string }) => {
    const apiKey = process.env.COGNEE_API_KEY;
    const { datasetId, url, chatId } = data;
    const isChat = datasetId === 'chat_sessions' || chatId !== undefined;
    const itemKey = isChat ? chatId : url;
    
    console.log(`[Cognee SDK Local] Forgetting memory for dataset ${datasetId}: ${itemKey}`);

    if (isPlaceholderKey(apiKey)) {
      console.log(`[Cognee SDK Local] COGNEE_API_KEY is placeholder. Deleting from mock local memory storage.`);
      const initialLength = memoryStore.length;
      const index = memoryStore.findIndex(m => {
        if (isChat) {
          return m.chatId === chatId && m.datasetId === datasetId;
        }
        return m.url === url && m.datasetId === datasetId;
      });
      
      if (index !== -1) {
        memoryStore.splice(index, 1);
      }
      return { success: true, deleted: memoryStore.length < initialLength };
    }

    try {
      const targetName = isChat ? 'chat_sessions' : 'research_memory';
      let targetDatasetId = datasetUuidCache.get(targetName);
      if (!targetDatasetId) {
        const listResp = await fetch(`${COGNEE_BASE_URL}/api/v1/datasets`, {
          method: 'GET',
          headers: {
            'X-Api-Key': apiKey || '',
            'X-Tenant-Id': COGNEE_TENANT_ID
          }
        });
        if (!listResp.ok) throw new Error(`List datasets status ${listResp.status}`);
        const datasets = await listResp.json() as any[];
        const targetDataset = datasets.find(d => d.name === targetName);
        if (targetDataset) {
          targetDatasetId = targetDataset.id;
          datasetUuidCache.set(targetName, targetDataset.id);
        }
      }

      if (!targetDatasetId) {
        return { success: true, deleted: false };
      }
      
      const dataResp = await fetch(`${COGNEE_BASE_URL}/api/v1/datasets/${targetDatasetId}/data`, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey || '',
          'X-Tenant-Id': COGNEE_TENANT_ID
        }
      });
      if (!dataResp.ok) throw new Error(`Get data items status ${dataResp.status}`);
      const dataItems = await dataResp.json() as any[];
      if (!dataItems || !Array.isArray(dataItems)) {
        return { success: true, deleted: false };
      }
      
      const matchingItems: any[] = [];
      const checkAndCollect = async (item: any) => {
        if (isChat && chatId) {
          if (item.name.startsWith('chat_') && item.name !== `chat_${chatId}` && item.name !== `chat_${chatId}.json`) {
            return;
          }
        } else if (url) {
          const expectedName = `mem_${Buffer.from(url).toString('hex')}`;
          if (item.name.startsWith('mem_') && item.name !== expectedName && item.name !== `${expectedName}.json`) {
            return;
          }
        }

        try {
          const rawResp = await fetch(`${COGNEE_BASE_URL}/api/v1/datasets/${targetDatasetId}/data/${item.id}/raw`, {
            method: 'GET',
            headers: {
              'X-Api-Key': apiKey || '',
              'X-Tenant-Id': COGNEE_TENANT_ID
            }
          });
          if (rawResp.ok) {
            const text = await rawResp.text();
            let matches = false;
            try {
              const parsed = JSON.parse(text);
              if (isChat) {
                matches = parsed && parsed.chatId === chatId;
              } else {
                matches = parsed && parsed.url === url;
              }
            } catch (e) {
              if (!isChat && url) {
                matches = text.includes(url);
              }
            }
            if (matches) {
              matchingItems.push(item);
            }
          }
        } catch (err) {
          console.warn(`[Cognee SDK Local] Failed check for item ${item.id}:`, err);
        }
      };

      const checkLimit = 4;
      for (let i = 0; i < dataItems.length; i += checkLimit) {
        const chunk = dataItems.slice(i, i + checkLimit);
        await Promise.all(chunk.map(checkAndCollect));
      }

      const deletePromises = matchingItems.map(async (item) => {
        try {
          console.log(`[Cognee SDK Local] Deleting data item ${item.id} from dataset ${targetDatasetId}`);
          const delResp = await fetch(`${COGNEE_BASE_URL}/api/v1/datasets/${targetDatasetId}/data/${item.id}`, {
            method: 'DELETE',
            headers: {
              'X-Api-Key': apiKey || '',
              'X-Tenant-Id': COGNEE_TENANT_ID
            }
          });
          return delResp.ok;
        } catch (err) {
          console.warn(`[Cognee SDK Local] Delete failed for ${item.id}:`, err);
        }
        return false;
      });

      const results = await Promise.all(deletePromises);
      const deletedCount = results.filter(Boolean).length;
      return { success: true, deleted: deletedCount > 0, count: deletedCount };
    } catch (err: any) {
      console.warn(`[Cognee SDK Local] Real Cognee forget API failed: ${err.message}. Deleting locally.`);
      const index = memoryStore.findIndex(m => {
        if (isChat) {
          return m.chatId === chatId && m.datasetId === datasetId;
        }
        return m.url === url && m.datasetId === datasetId;
      });
      if (index !== -1) {
        memoryStore.splice(index, 1);
      }
      return { success: true, deleted: true };
    }
  }
};
