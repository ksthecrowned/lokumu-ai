# Lokumu AI System Architecture

## 1. High-Level Architecture Overview

Lokumu AI is designed as a modular, domain-oriented system with clear separation of concerns. The architecture follows a microservices-inspired approach for scalability, while maintaining simplicity for the initial MVP (local functional version for investor presentations).

### Core Architectural Principles
- **Modularity**: Each concern (auth, chat, RAG, models) is encapsulated in independent services
- **Domain-Oriented**: Services organized by business capability rather than technical layers
- **Technology Agnosticism**: Interfaces defined via APIs allowing future tech swaps
- **Local-First**: Designed to operate fully on-premise with optional cloud extension
- **Multilingual by Design**: Language support integrated at the data layer

### Component Diagram (Mermaid)
```mermaid
graph TD
    A[User Interface] --> B[Lokumu Web (Next.js)]
    B --> C[API Gateway]
    C --> D[Auth Service]
    C --> E[Chat Service]
    C --> F[RAG Service]
    C --> G[Model Service]
    G --> H[Inference Workers]
    H --> I[(Quantized Models: Qwen/DeepSeek)]
    F --> J[(PostgreSQL + pgvector)]
    D --> J
    E --> J
    J --> K[Embeddings Storage]
    L[Admin Dashboard] --> C
    M[External Data Sources] --> F
    style I fill:#f9f,stroke:#333
    style J fill:#bbf,stroke:#333
```

### Data Flow for Chat Request
1. User submits message via Lokumu Web (Next.js)
2. Request routed through API Gateway to Chat Service
3. Chat Service validates session (via Auth Service)
4. Chat Service queries RAG Service for relevant context
5. RAG Service performs vector search in PostgreSQL+pgvector
6. Chat Service constructs prompt with retrieved context
7. Chat Service requests generation from Model Service
8. Model Service distributes to available Inference Workers
9. Workers generate response using quantized LLM (Qwen/DeepSeek)
10. Response streamed back through the chain to user

## 2. GitHub Repository Structure

Based on your existing folders, here's the refined organization with clear responsibilities:

```bash
lokumu-ai/
├── lokumu-api/           # Backend services (NestJS monolith for MVP)
├── lokumu-web/           # Frontend (Next.js + TypeScript)
├── lokumu-models/        # Model artifacts (GGUF, adapters, configs)
├── lokumu-datasets/      # Training/evaluation datasets (multilingual)
├── lokumu-rag/           # RAG pipelines, chunking, embedding configs
├── lokumu-docs/          # Technical/user documentation
└── lokumu-infra/         # Deployment configs (Docker, Kubernetes, scripts)
```

**Reasoning**: 
- Keeping API as a NestJS monolith initially simplifies development and deployment for MVP
- Separate `lokumu-infra` isolates deployment concerns
- Model and dataset repos remain separate for versioning large artifacts
- RAG gets its own repo due to specialized pipelines and configs

## 3. Organization of Folders Per Repository

### lokumu-api/ (NestJS)
```bash
lokumu-api/
├── src/
│   ├── auth/             # Authentication module (JWT, sessions)
│   ├── chat/             # Chat logic, message handling
│   ├── rag/              # RAG service integration
│   ├── model/            # Model service abstraction
│   ├── common/           # Shared guards, interceptors, DTOs
│   ├── config/           # Environment configuration
│   └── main.ts
├── test/
├── docker/
│   └── Dockerfile
└── nest-cli.json
```

### lokumu-web/ (Next.js)
```bash
lokumu-web/
├── src/
│   ├── app/              # App router (Next.js 13+)
│   │   ├── (chat)/       # Protected chat routes
│   │   ├── api/          # API routes (proxy to backend)
│   │   └── login/        # Auth pages
│   ├── components/       # Reusable UI components
│   │   ├── chat/         # Chat-specific components
│   │   └── ui/           # Generic UI (buttons, inputs)
│   ├── lib/              # Utilities, API clients
│   ├── styles/           # CSS/modules
│   └── types/            # TypeScript definitions
├── public/
├── docker/
│   └── Dockerfile
└── next.config.js
```

### Other Repos (Standardized)
```bash
# lokumu-models/
├── qwen/                 # Qwen model variants
│   ├── qwen2-7b-chat/    # GGUF quantized versions
│   │   ├── qwen2-7b-chat-q4_k_m.gguf
│   │   └── config.json
│   └── README.md
├── deepseek/             # DeepSeek variants
└── README.md             # Model usage guide

# lokumu-datasets/
├── raw/                  # Original scraped/collected data
├── processed/            # Cleaned, language-tagged datasets
│   ├── conversations/    # Multilingual chat examples
│   ├── documents/        # Articles, books, legal texts
│   └── eval/             # Evaluation sets
├── scripts/              # Processing, filtering scripts
└── README.md

# lokumu-rag/
├── pipelines/            # Chunking, embedding strategies
│   ├── linguistics/      # Language-specific rules
│   └── strategies/       # Semantic, sliding window, etc.
├── configs/              # Vector DB, retriever configs
├── evaluations/          # RAG quality metrics
└── README.md

# lokumu-infra/
├── docker-compose/
│   ├── dev.yml           # Development stack
│   └── prod.yml          # Production-ready
├── kubernetes/
│   ├── base/
│   └── overlays/
├── scripts/              # Deployment, maintenance utilities
└── README.md
```

## 4. Technology Recommendations & Justification

| Layer              | Technology                          | Reasoning                                                                 |
|--------------------|-------------------------------------|---------------------------------------------------------------------------|
| **Frontend**       | Next.js 14 + TypeScript             | SSR/SSG for SEO, app router, excellent DX, mutual with Vercel deployment  |
| **Backend**        | NestJS + TypeScript                 | Modular, DI, excellent for enterprise apps, TypeScript consistency        |
| **Database**       | PostgreSQL 15 + pgvector            | ACID compliance, proven scalability, native vector support via pgvector   |
| **ORM**            | Prisma                              | Type-safe, great DX, migrations, PostgreSQL + vector support              |
| **Inference**      | llama.cpp (via Python wrapper)      | CPU-optimized, GGUF support, efficient quantization, active community     |
| **Model Format**   | GGUF                                | Single-file, memory-mapped, quantized, works with llama.cpp               |
| **Orchestration**  | LangGraph                           | Flexible agent workflows, state management, LangChain ecosystem           |
| **Cache**          | Redis                               | Session storage, response caching, pub/sub for real-time features         |
| **Message Queue**  | RabbitMQ                            | Reliable async processing (future: fine-tuning jobs)                      |
| **API Gateway**    | NestJS built-in                     -           -                         |
| **WebSocket**      | NestJS WebSocket gateway            -           -                         |
| **Containerization**| Docker                              -           -                         |
| **Observability**  | Prometheus + Grafana + Loki         -           -                         |

**Specific Justifications for Local Constraints**:
- **GGUF + llama.cpp**: Enables 4-bit/8-bit quantization on CPU-only hardware. A Qwen2-7B model in Q4_K_M quantization uses ~3.8GB RAM, leaving headroom for OS, embedding model (bge-small-en-v1.5 ~500MB), and concurrent requests.
- **Prisma over TypeORM**: Better PostgreSQL + vector support, superior migration system.
- **Redis for caching**: Essential for reducing LLM inference load on repeated queries; stores chat summaries and frequent responses.
- **Avoiding Kubernetes for MVP**: Docker-compose sufficient for local demo; K8s added in `lokumu-infra` for future scaling.

## 5. Naming Conventions

| Context               | Convention          | Examples                                  |
|-----------------------|---------------------|-------------------------------------------|
| **Repositories**      | kebab-case          | `lokumu-api`, `lokumu-web`                |
| **Database Tables**   | snake_case          | `user_sessions`, `chat_messages`          |
| **Database Columns**  | snake_case          | `user_id`, `created_at`                   |
| **TS Classes/Interfaces** | PascalCase      | `AuthService`, `ChatMessageDto`           |
| **TS Functions/vars** | camelCase           | `generateResponse()`, `userSession`       |
| **TS Constants**      | UPPER_SNAKE_CASE    | `MAX_MESSAGE_LENGTH`, `DEFAULT_TEMPERATURE` |
| **API Endpoints**     | kebab-case          | `/api/v1/chats`, `/auth/refresh-token`    |
| **Environment Vars**  | UPPER_SNAKE_CASE    | `DATABASE_URL`, `LLM_MODEL_PATH`          |
| **Docker Images**     | lowercase-slash     | `lokumu/api:dev`, `lokumu/web:latest`     |
| **Git Branches**      | feature/, fix/, feat/ | `feature/multilingual-support`            |

## 6. Core Modules Breakdown

### 6.1 Auth Service (`lokumu-api/src/auth`)
**Responsibilities**: User registration, login, session management, role-based access control (RBAC)
**Key Features**:
- JWT access tokens (15-min expiry) + refresh tokens (7-day)
- Password hashing with bcrypt (cost: 12)
- Optional: OIDC/LDAP integration for enterprise
- Rate limiting on auth endpoints (prevent brute force)
- Session invalidation on password change

**Why JWT for MVP?**: Stateless, simple to implement, works well with microservices later. Can evolve to session-store (Redis) if needed.

### 6.2 Chat Service (`lokumu-api/src/chat`)
**Responsibilities**: Conversation management, message processing, context assembly
**Key Features**:
- Conversation threading with persistent storage
- Message streaming (Server-Sent Events/WebSocket)
- Language detection per message (fasttext or langdetect)
- Profanity filtering (multilingual word lists)
- Token counting for context window management
- Conversation summarization for long chats

**Language Detection**: Use `langdetect` (Python) via microservice call or `franc-min` (JS) for client-side hint. Critical for routing to appropriate models/embeddings later.

### 6.3 RAG Service (`lokumu-api/src/rag` + `lokumu-rag` repo)
**Responsibilities**: Document ingestion, embedding generation, retrieval
**Key Features**:
- Multilingual sentence transformers (BAAI/bge-m3: 100+ languages)
- Configurable chunking strategies (by language, document type)
- Hybrid search: vector + keyword (PostgreSQL full-text + pgvector)
- Metadata filtering (language, date, source domain)
- Automatic re-embedding when models update
- Evaluation suite (MRR, recall@k)

**Embedding Choice**: BGE-M3 supports all target languages (French, Lingala, Kituba, English, Swahili) in one model, avoiding language-specific model switching.

### 6.4 Model Service (`lokumu-api/src/model`)
**Responsibilities**: LLM inference management, worker coordination, prompt engineering
**Key Features**:
- Worker pool management (llama.cpp instances)
- Quantization-aware loading (Q4_K_M, Q5_K_S, etc.)
- Prompt templating per use case (chat, summarization, etc.)
- Dynamic batching for throughput
- Fallback to smaller models if OOM
- Telemetry: tokens/sec, latency, VRAM/RAM usage

**Worker Pattern**: 
- Each worker loads one model instance
- Model service dispatches requests to least-loaded worker
- Workers communicate via Unix sockets or HTTP (localhost)
- Enables horizontal scaling later (multiple inference servers)

## 7. Database Schema Snippets (Prisma)

### `prisma/schema.prisma` (excerpt)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---- Core Entities ----
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  firstName     String?
  lastName      String?
  language      String   @default("fr") // Preferred UI language
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  sessions      Session[]
  conversations Conversation[]
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id])
}

model Conversation {
  id            String   @id @default(uuid())
  userId        String
  title         String   @default("Nouvelle conversation")
  language      String   // Detected or set by user
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id])
  messages      ChatMessage[]
}

model ChatMessage {
  id            String   @id @default(uuid())
  conversationId String
  content       String
  role          String   // "user" | "assistant" | "system"
  language      String   // Detected language of this message
  timestamp     DateTime @default(now())
  conversation  Conversation @relation(fields: [conversationId], references: [id])
  // For RAG: store which chunks were used (optional)
  usedChunkIds  String[] @default([])
}

// ---- RAG Entities ----
model Document {
  id            String   @id @default(uuid())
  source        String   // URL, file path, etc.
  title         String?
  language      String   // ISO 639-3: fra, lin, swa, etc.
  content       String
  chunks        Chunk[]
  createdAt     DateTime @default(now())
}

model Chunk {
  id             String   @id @default(uuid())
  documentId     String
  content        String
  tokenCount     Int
  embedding      Vector   // pgvector type, 1024 dims for BGE-M3
  metadata       Json     // { page: int, section: string, etc. }
  document       Document @relation(fields: [documentId], references: [id])
}

// ---- Indexes for Performance ----
model ChatMessage {
  // ... existing fields
  @@index([conversationId, timestamp])
  @@index([language])
}

model Chunk {
  // ... existing fields
  @@index([embedding]) // Uses pgvector ivfflat or hnsw index
  @@index([language])
}
```

**Reasoning**:
- UUIDs prevent enumeration attacks, support distributed systems
- Language stored at message/document level for granular filtering
- JSON metadata flexible for document provenance
- pgvector indexing critical for sub-second retrieval on large datasets
- Minimal denormalization: only store essential derived data (language, token count)

## 8. API Endpoints

### Public Endpoints
| Method | Endpoint             | Description                     |
|--------|----------------------|---------------------------------|
| POST   | `/auth/register`     | User registration               |
| POST   | `/auth/login`        | Login (returns access/refresh)  |
| POST   | `/auth/refresh`      | Refresh access token            |
| GET    | `/health`            | Liveness/readiness check        |

### Protected Endpoints (Require Auth)
| Method | Endpoint                     | Description                                   |
|--------|------------------------------|-----------------------------------------------|
| GET    | `/chats`                     | List user's conversations                     |
| POST   | `/chats`                     | Create new conversation                       |
| GET    | `/chats/:id`                 | Get conversation with messages                |
| POST   | `/chats/:id/messages`        | Send message (returns streaming response)     |
| DELETE | `/chats/:id`                 | Delete conversation                           |
| GET    | `/documents`                 | List uploaded documents (for RAG)             |
| POST   | `/documents`                 | Upload document for RAG ingestion             |
| GET    | `/models`                    | List available LLMs with status               |
| POST   | `/models/:id/unload`         | Unload model to free memory                   |

**WebSocket Endpoint**: `ws://localhost:3000/ws/chats/:id` for real-time message streaming.

## 9. User Authentication & Authorization

### Flow
1. **Registration**: 
   - User provides email, password, preferred language
   - Backend hashes password (bcrypt), creates User record
   - Returns minimal user object (no password)

2. **Login**:
   - Validate email/password
   - Generate access token (JWT, 15min) + refresh token (JWT, 7day)
   - Store refresh token hash in DB (rotate on use)
   - Set access token in HTTP-only cookie + return in body
   - Set refresh token in HTTP-only cookie (different path)

3. **Token Usage**:
   - Access token: Sent in `Authorization: Bearer <token>` header
   - Refresh token: Sent via HTTP-only cookie to `/auth/refresh`
   - On refresh: Validate refresh token hash, issue new pair

4. **Authorization**:
   - NestJS `@Roles()` guard checks user role from JWT payload
   - Roles: `user`, `admin`, `moderator` (future)
   - Resource ownership: Check userId matches request (e.g., chat deletion)

### Security Considerations
- **CSRF Protection**: Double-submit cookie or SameSite=Strict cookies
- **Rate Limiting**: 10 login attempts/min per IP (using express-rate-limit or NestJS throttler)
- **Password Policy**: Min 12 chars, require mixed case, number, symbol
- **Account Lockout**: After 5 failed attempts, lock for 15min
- **Audit Log**: Log all auth events (login success/fail, token refresh) to separate table

## 10. Memory & RAG Management

### Memory Hierarchy
| Layer              | Purpose                          | Technology          | Size/Limit          |
|--------------------|----------------------------------|---------------------|---------------------|
| **Working Memory** | Current conversation context     | In-memory (chat)    | Last 20 messages    |
| **Short-Term**     | Recent conversation summary      | Redis (per session) | 1 conversation      |
| **Long-Term**      | User preferences, history        | PostgreSQL          | Indefinite          |
| **Knowledge Base** | Document embeddings              | PostgreSQL + pgvector | Scalable to TBs    |

### RAG Pipeline
1. **Ingestion** (`lokumu-rag` repo):
   - Accept PDF, TXT, DOCX, URL
   - Extract text (using unstructured.io or custom)
   - Detect language (langdetect/fasttext)
   - Clean: remove headers/footers, fix encoding
   - Chunk: 
     ```python
     # Pseudocode - language-aware chunking
     if language in ["lin", "swa"]:  # Agglutinative languages
         chunk_size = 128  # Smaller chunks for morphology
     else:
         chunk_size = 256
     chunks = sliding_window(text, chunk_size, overlap=50)
     ```
   - Generate embeddings (BGE-M3 via sentence-transformers)
   - Store in PostgreSQL with metadata

2. **Retrieval** (at query time):
   - Detect query language
   - Generate query embedding (same model)
   - Search: 
     ```sql
     -- Hybrid search example
     WITH vector_search AS (
       SELECT id, content, 1 - (embedding <=> query_embedding) AS similarity
       FROM chunks 
       WHERE language = query_language
       ORDER BY embedding <=> query_embedding 
       LIMIT 20
     ),
     keyword_search AS (
       SELECT id, content, ts_rank_cd(to_tsvector('simple', content), query) AS rank
       FROM chunks
       WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', query)
       AND language = query_language
       ORDER BY rank DESC
       LIMIT 20
     )
     SELECT * FROM vector_search
     UNION
     SELECT * FROM keyword_search
     ORDER BY similarity DESC, rank DESC
     LIMIT 5
     ```
   - Rerank using cross-encoder (optional, for quality)
   - Return top chunks to chat service

3. **Context Assembly**:
   - Truncate chunks to fit LLM context window (reserving space for prompt/history)
   - Format: 
     ```
     [CONTEXT]
     Relevant excerpt 1 (source: document.pdf, p.5)
     Relevant excerpt 2 (source: article.txt, p.2)
     ...
     [/CONTEXT]
     User question: {message}
     Answer in {detected_language}:
     ```

### Memory Optimization for Local Hardware
- **Embedding Model**: Use BGE-M3 (560MB quantized) or smaller BGE-SMALL (220MB) if RAM constrained
- **Chunk Storage**: Store only content + embedding in DB; keep original files in `lokumu-datasets/raw/`
- **Cache Layers**: 
  - Redis: cache frequent query embeddings (LRU, 1hr TTL)
  - LRU in Model Service: cache recent LLM responses for identical prompts
- **Context Window**: Target 4k tokens for Qwen2-7B (leaves room for generation)

## 11. AI Agents System (LangGraph)

### Agent Types for MVP
1. **Chat Agent**: 
   - Main orchestrator for conversation flow
   - Tools: `search_knowledge_base`, `get_conversation_history`, `detect_language`
   - Decision: Whether to use RAG or direct chat (based on query type)

2. **Summarization Agent** (future):
   - Creates conversation summaries for long-term memory
   - Triggered when conversation > 15 messages

3. **Evaluation Agent** (future):
   - Scores response quality (relevance, safety, language correctness)
   - Uses LLM-as-a-judge with rubric

### LangGraph Implementation (simplified)
```python
# lokumu-rag/src/agents/chat_agent.py
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated

class AgentState(TypedDict):
    messages: List[BaseMessage]
    language: str
    context: List[str]
    needs_rag: bool
    response: str

def should_use_rag(state: AgentState) -> str:
    # Simple heuristic: factual queries need RAG
    factual_indicators = ["what", "who", "when", "where", "why", "how"]
    last_msg = state["messages"][-1].content.lower()
    if any(indicator in last_msg for indicator in factual_indicators):
        return "use_rag"
    return "direct_chat"

def retrieve_context(state: AgentState) -> AgentState:
    # Call RAG service via API
    context = query_rag_service(state["messages"][-1].content, state["language"])
    return {**state, "context": context, "needs_rag": True}

def generate_response(state: AgentState) -> AgentState:
    prompt = build_prompt(
        history=state["messages"][:-1],
        context=state["context"] if state["needs_rag"] else [],
        current_query=state["messages"][-1].content,
        language=state["language"]
    )
    response = call_model_service(prompt)
    return {**state, "response": response}

# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("decide_rag", should_use_rag)
workflow.add_node("retrieve", retrieve_context)
workflow.add_node("generate", generate_response)

workflow.set_entry_point("decide_rag")
workflow.add_conditional_edges(
    "decide_rag",
    lambda x: x["needs_rag"],
    {True: "retrieve", False: "generate"}
)
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

app = workflow.compile()
```

**Reasoning for LangGraph**:
- Visual workflow debugging (LangGraph Studio)
- Easy to add/remove agents without rewriting core logic
- State persistence enables long-running agent processes
- Integrates well with LangChain ecosystem (tools, memory)

## 12. Fine-Tuning Preparation Strategy

While MVP uses base models, architecture supports future LoRA/QLoRA fine-tuning:

### Training Pipeline Components
1. **Data Preparation** (`lokumu-datasets`):
   - Curated instruction-response pairs in target languages
   - Format: Alpaca or ShareGPT JSON
   - Quality filtering: perplexity, language similarity, toxicity checks

2. **Training Service** (separate repo or `lokumu-infra/scripts`):
   - Uses `unsloth` or `axolotl` for efficient LoRA
   - Supports QLoRA (4-bit quantization during training)
   - Tracks experiments with MLflow or Weights & Biases
   - Outputs: LoRA adapters (not full models)

3. **Model Service Integration**:
   - Dynamically load LoRA adapters atop base model
   - Routing: 
     - Base model: general chat
     - LoRA-chat: fine-tuned conversational style
     - LoRA-code: for Lokumu-1-Coder variant
     - LoRA-reasoning: for Lokumu-1-Reasoning variant

### Resource Requirements for Local Fine-Tuning
- **GPU Preferred**: Even entry-level GPU (GTX 1660+) speeds up training 10x
- **CPU Fallback**: Possible with bitsandbytes + CPU offload (very slow)
- **Quantization**: Train in 4-bit, store adapters as ~100MB files
- **Example**: Fine-tuning Qwen2-7B on 5k examples:
  - GPU (T4): ~2 hours
  - CPU (i5-8365U): ~2-3 days (not practical for iterative dev)

**Recommendation**: Initially use base models; present fine-tuning roadmap to investors as "Phase 2: Specialized variants".

## 13. Dataset Storage Strategy

### Tiered Approach
| Tier             | Use Case                     | Technology          | Access Pattern      |
|------------------|------------------------------|---------------------|---------------------|
| **Hot**          | Active training/inference    | Local NVMe SSD      | Millisecond latency |
| **Warm**         | Archive, infrequent access   | External SSD/HDD    | Second latency      |
| **Cold**         | Long-term backup             | LTO tape/cloud      | Hour+ latency       |
| **Analytical**   | Dataset exploration          | DuckDB/Parquet      | Interactive query   |

### Implementation
- **Primary Storage**: 
  - `~/lokumu-data/datasets/` mounted to containers
  - Organized by: `source/language/raw|processed/`
  - Example: `wikipedia/fr/processed/articles_2024.parquet`
  
- **Metadata Catalog** (PostgreSQL table):
  ```sql
  CREATE TABLE dataset_catalog (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      source_url TEXT,
      language TEXT CHECK (language IN ('fra','lin','swa','eng','aka',...)),
      format TEXT CHECK (format IN ('jsonl','parquet','csv')),
      size_bytes BIGINT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      description TEXT,
      tags TEXT[]
  );
  ```

- **Version Control for Data**:
  - Use DVC (Data Version Control) for large files
  - Or simple: `datasets/v1.0/`, `datasets/v1.1/` with changelog.md
  - Avoid Git LSF for MVP complexity

- **Processing Pipeline**:
  ```mermaid
  graph LR
    A[Raw Data] --> B[Validation & Cleaning]
    B --> C[Language Detection]
    C --> D{Language Supported?}
    D -->|Yes| E[Chunking & Embedding]
    D -->|No| F[Reject/Translate]
    E --> G[Store in DB + Object Storage]
    G --> H[Update Catalog]
    style F fill:#f96,stroke:#333
  ```

### Language-Specific Considerations
- **Lingala/Kituba**: Limited NLP resources; rely on sentence-transformers multilingual models
- **Swahili**: Relatively well-resourced; can use AfroXLMR
- **French/English**: Abundant resources; prioritize high-quality sources
- **Data Sources**: 
  - Wikipedia dumps (all target languages)
  - OSCOR (African corpora)
  - Common Crawl (filtered by language)
  - Government publications (open data portals)
  - Community contributions (future)

## 14. Deployment Strategies

### Local Deployment (Investor Demo)
**Docker Compose** (`lokumu-infra/docker-compose/dev.yml`):
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: lokumu
      POSTGRES_USER: lokumu
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "lokumu"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --save 60 1 --loglevel warning

  api:
    build: ./lokumu-api
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://lokumu:${POSTGRES_PASSWORD}@postgres:5432/lokumu
      - REDIS_URL=redis://redis:6379
      - MODEL_PATH=/models
    volumes:
      - ./lokumu-api:/app
      - ./lokumu-models:/models:ro
      - ./lokumu-datasets:/datasets:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build: ./lokumu-web
    ports:
      - "3001:3001"
    volumes:
      - ./lokumu-web:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    depends_on:
      - api

volumes:
  postgres_data:
```

**Inference Service Addition** (for better separation):
```yaml
  inference:
    build: ./lokumu-inference  # New service
    ports:
      - "8000:8000"
    environment:
      - MODEL_PATH=/models
      - NUM_WORKERS=2  # Based on CPU cores
    volumes:
      - ./lokumu-inference:/app
      - ./lokumu-models:/models:ro
      - ./dev-shared-models:/dev-shared  # For sharing quantized models
    deploy:
      resources:
        reservations:
          devices:
            - driver: cuda
              count: 0  # CPU-only
        limits:
          memory: 8G  # Leave room for other services
```

### Cloud Deployment Preparation
**Kubernetes Manifests** (`lokumu-infra/kubernetes/`):
- Separate deployments for each service (auth, chat, web, etc.)
- HorizontalPodAutoscaler based on CPU/RAM/queue depth
- PersistentVolumes for PostgreSQL (using cloud provider's managed DB recommended)
- ConfigMaps for non-secret configuration
- Secrets for passwords, API keys (integrated with cloud KMS)
- Ingress controller (NGINX or cloud-native)
- Monitoring: Prometheus Operator, Grafana dashboards
- Logging: Loki + Promtail or ELK stack

**Environment Parity**:
- Use same docker images locally and in cloud
- Feature flags for cloud-only services (e.g., managed Redis vs self-hosted)
- Database connection string as sole env var difference

## 15. Security, Monitoring & Scalability

### Security Measures
| Layer              | Controls                                                                 |
|--------------------|--------------------------------------------------------------------------|
| **Network**        | - TLS 1.3 everywhere (Let's Encrypt locally, cloud certs in prod)<br>- API Gateway: rate limiting, IP allowlists for admin<br>- Database: VPC isolation, no public internet access |
| **Application**    | - Input validation (class-validator + sanitizer-html)<br>- Output encoding (to prevent XSS)<br>- CSRF protection (double-submit cookie)<br>- Security headers (Helmet.js equivalent)<br>- Dependency scanning (npm audit, safety) |
| **Data**           | - Encryption at rest (LUKS for disks, TDE for PostgreSQL optional)<br>- Field-level encryption for PII (if needed)<br>- Regular backups (automated to object storage)<br>- GDPR-compliant data deletion |
| **Monitoring**     | - Failed login alerts (brute force detection)<br>- Anomalous query detection (SQLi, prompt injection)<br>- Model output safety checks (toxicity, bias) |
| **Human**          | - Regular security training for devs<br>- Penetration testing scope (external/internet-facing)<br>- Bug bounty program (future) |

### Monitoring & Observability
**Metrics** (Prometheus):
- **System**: CPU, memory, disk, network (node_exporter)
- **Application**: 
  - Request latency (by endpoint, status code)
  - Error rates (5xx, 4xx)
  - Database query performance
  - Cache hit ratios (Redis, LLM response)
  - LLM throughput (tokens/sec, requests/sec)
  - Active conversations, users
- **Business**:
  - Messages per user/day
  - Language distribution
  - RAG retrieval latency
  - User retention (DAU/MAU)

**Logs** (Structured JSON):
```json
{
  "timestamp": "2026-06-19T10:30:00Z",
  "level": "info",
  "service": "chat-service",
  "trace_id": "abc-123",
  "user_id": "user-123",
  "action": "message_received",
  "message_length": 142,
  "detected_language": "lin",
  "used_rag": true,
  "context_chunks": 3,
  "response_time_ms": 1250
}
```

**Distributed Tracing** (Jaeger or Tempo):
- Track request flow: API Gateway → Auth → Chat → RAG → Model → Web
- Essential for diagnosing latency issues in microservices

### Scalability Strategies
| Dimension          | Approach                                                                 |
|--------------------|--------------------------------------------------------------------------|
| **Vertical**       | - Optimize inference batching<br>- Tune pgvector indexes (ivfflat vs hnsw)<br>- Increase connection pools<br>- Redis maxmemory policy |
| **Horizontal**     | - Stateless services (API, web) behind load balancer<br>- Read replicas for PostgreSQL (analytics/offload)<br>- Sharding by user ID range (future)<br>- Multiple inference workers (GPU nodes) |
| **Caching**        | - Multi-level: L1 (in-process), L2 (Redis), L3 (CDN for static assets)<br>- Cache warming for frequent queries<br>- Cache invalidation on document update |
| **Database**       | - Partition conversations by date (time-series)<br>- Archive old conversations to cheaper storage<br>- Use connection pooling (PgBouncer)<br>- Read replicas for reporting |
| **ML Specific**    | - Model quantization (4-bit → 3-bit if needed)<br>- Dynamic batching in inference service<br>- Model caching (LRU of loaded models)<br>- Asynchronous generation (WebSockets/SSE) |

**Scaling Triggers for MVP**:
- Single node (current i5-8365U) → supports ~2-3 concurrent users <5s latency
- Add GPU (e.g., T4) → 10x inference throughput
- Add second CPU node → horizontal scaling for API/web
- Add read replica → scale read-heavy workloads (RAG retrieval)

## Next Steps for Implementation

1. **Week 1**: Setup repos, docker-compose, basic auth/chat endpoints
2. **Week 2**: Integrate PostgreSQL + Prisma, implement basic CRUD
3. **Week 3**: Add RAG pipeline with embedding generation
4. **Week 4**: Integrate llama.cpp inference service, test with Qwen2-7B-Q4
5. **Week 5**: Implement language detection, multilingual UI
6. **Week 6**: Add WebSocket streaming, basic frontend chat
7. **Week 7**: Security hardening, monitoring setup
8. **Week 8**: Performance optimization, investor demo preparation

This architecture provides a solid foundation that:
- Delivers a functional local MVP for investor presentations
- Is scalable to cloud and higher traffic
- Supports the multilingual requirement from day one
- Prepares for future evolution to Lokumu-1 variants
- Follows industry best practices for security and maintainability
- Works within the constraints of your current hardware

Would you like me to elaborate on any specific section, or shall we proceed to implement the first component?