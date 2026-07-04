# 🧠 InfinityAI Backend RAG Server

The backend acts as the core API service, orchestration engine, and semantic router of the InfinityAI personal second brain.

---

## 🛠️ How It Works

1. **Memory Ingestion API (`/api/memory/ingest`)**:
   * Accepts HTML and raw textual payloads sent by the Chrome extension.
   * Parses the page content and indexes it into your dedicated **Cognee Cloud** tenant workspace.
2. **Semantic Search & Retrieval (`/api/memory/search`)**:
   * Uses weighted keyword matching and stop-words filters to rank saved articles.
   * Feeds the most relevant context block to the LLM.
3. **Conversational LLM RAG (`/api/chat`)**:
   * Compiles the conversation thread history with the search context.
   * Invokes the **Groq Llama 3.1-8b-instant** model to generate structured, cited JSON responses.
4. **Persistent Chat Sessions (`/api/chats`)**:
   * Exposes CRUD endpoints to create, fetch, delete, and list chat threads stored directly inside your Cognee tenant database.

---

## ⚙️ Development Environment
* Run local server: `npm run dev` (starts on `http://localhost:5000`)
* Build TypeScript project: `npm run build`
