**Project Name**
**AxientOS — The AI Business System Generator**
---
## 📌 **System Purpose (Prompt Summary)**
> Build AxientOS — a fully autonomous AI SaaS system that allows businesses to dynamically generate complete operational systems through AI-powered business interviews, automatic module generation, full MCP agent orchestration (Intent, Retriever, Tool, Workflow, Memory, Follow, Formatter, Guardrail, LLM), visual workflow management, internal API building, dynamic knowledge ingestion, real-time execution, and complete multi-tenant SaaS control — fully production-grade.
---
## 📌 **Core Functional Modules**
### 1️⃣ AI System Builder:
- **AI Business Interview Module** — Collect business needs via guided Q&A
- **Module Generator (HR, CRM, Orders, Finance, Support, Legal, Custom)** — Auto-generate full business modules based on interview
- **Data Schema & API Generator** — Auto-create DB tables and APIs
- **Auto UI Form Builder** — Generate Admin UI forms dynamically
- **Workflow Suggestion Engine** — Propose business workflows based on input
### 2️⃣ MCP Orchestration Agents:
- **Intent Agent** — Detect what user is requesting
- **Retriever Agent (RAG)** — Retrieve knowledge from uploaded documents
- **Tool Agent** — Call external or internal business APIs
- **Workflow Agent** — Execute business rules, multi-step processes
- **Memory Agent** — Store previous conversation state
- **FollowAgent** — Manage multi-turn conversation flow and task state
- **Formatter Agent** — Build proper prompts for LLM
- **Guardrail Agent** — Filter outputs for legality, policy, compliance
- **LLM Agent** — Generate natural language responses
### 3️⃣ Orchestration Engine:
- **MCP Core Orchestration Flow** — Direct agent collaboration
- **Workflow Engine** — Visual and executable business logic
- **Skill Graph Engine** — Map tasks to agent capabilities
- **Knowledge Graph Manager** — Convert documents into structured reasoning
- **Context & State Manager** — Maintain session state and decision context
### 4️⃣ Business Modules Auto-Generated:
- **CRM** — Manage customers, leads, and sales
- **HR** — Handle employees, leaves, and payroll
- **Finance** — Generate invoices, track payments
- **Orders** — Process product sales and deliveries
- **Support** — Manage support tickets and refunds
- **Legal** — Maintain policies, compliance, and contracts
- **Custom Module Builder** — Allow businesses to create custom modules
### 5️⃣ Admin SaaS Control Panel:
- **AI Providers Config** — Setup LLM providers (OpenAI, Hugging Face, etc)
- **Knowledge Base Upload & Parsing** — Upload files (PDF, DOCX, CSV), auto-parse, chunk, embed
- **Visual Workflow Builder** — Build process flows with drag-drop interface
- **Prompt Templates Editor** — Edit business response formats
- **API Integrations Manager** — Connect to third-party APIs
- **System Builder Interface** — Control all modules and AI-generated configurations
- **Widget Generator** — Create embeddable AI widgets for websites
- **Billing & SaaS Subscription** — Manage pricing plans and payments
- **Logs & Audit Tracking** — Monitor system activity
- **Tenant/User Management** — Control multi-tenant user access and SaaS customers
### 6️⃣ Infrastructure Stack:
- **nest js** — API & MCP agent orchestration
- **Next+react js + tailwindcss +shadcnFrontend** — SaaS Admin Panel
- **PostgreSQL + pgvector DB** — Data & vector embeddings
- **OpenAI, Hugging Face Embedding** — Embedding generation
- **File Parsing (PDF, DOCX, CSV)** — Knowledge ingestion pipeline
- **Web Scraper (optional)** — URL-based document ingestion
- **AWS / Azure Cloud** — Hosting & deployment
- **WebSockets ** — Real-time messaging
- **Redis & Horizon Queue** — Job queues and caching
- **Docker & Kubernetes Deployment** — Containerized scalable deployments
---
## 📌 **Full Data Flow Summary:**
```txt
User ➔ Intent Agent ➔ Retriever Agent ➔ Tool Agent ➔ Workflow Agent ➔ Memory Agent ➔ FollowAgent ➔ Formatter Agent ➔ Guardrail Agent ➔ LLM Agent ➔ Formatter ➔ Response 
```
---
## 📌 **User Experience Summary:**
1️⃣ Sign up & SaaS onboarding
2️⃣ AI interviews business owner ➔ system requirement collection
3️⃣ Auto-generate data models, modules, APIs, workflows, forms
4️⃣ Owner fine-tunes via no-code Admin Panel
5️⃣ AI-powered Assistant deployed
6️⃣ MCP agents execute business operations
---
## 📌 **Key Product Outcome:**
✅ No developer required ✅ Full business operating system auto-generated ✅ AI-native autonomous business orchestration ✅ Full SaaS platform fully modular, scalable, and multi-tenant.