# ChatKit Starter Template

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![NextJS](https://img.shields.io/badge/Built_with-NextJS-blue)
![OpenAI API](https://img.shields.io/badge/Powered_by-OpenAI_API-orange)

This repository is the simplest way to bootstrap a [ChatKit](http://openai.github.io/chatkit-js/) application. It ships with a minimal Next.js UI, the ChatKit web component, and a ready-to-use session endpoint so you can experiment with OpenAI-hosted workflows built using [Agent Builder](https://platform.openai.com/agent-builder).

## Repository layout (monorepo)

This is an npm workspaces monorepo with two independently deployable apps:

```text
apps/
├── web/    # Next.js + ChatKit frontend (production: Vercel)
└── agent/  # Standalone LangGraph.js Agent Server (production: Docker)
packages/
└── shared-types/  # Types/schemas shared between web and agent
docker-compose.yml # Local-dev-only orchestration for web + agent
```

`apps/web` and `apps/agent` are separate npm workspaces with independent
`package.json`, dependencies, and Dockerfiles. Docker Compose is only a local
development convenience — production deploys each app independently (web to
Vercel, agent as its own container image).

## What You Get

- Next.js app with `<openai-chatkit>` web component and theming controls, in [apps/web](apps/web)
- API endpoint for creating a session at [apps/web/app/api/create-session/route.ts](apps/web/app/api/create-session/route.ts)
- Config file for starter prompts, theme, placeholder text, and greeting message
- A standalone LangGraph.js Agent Server skeleton in [apps/agent](apps/agent), ready for `langgraph dev` / LangGraph Studio

## Getting Started

### Option A — Docker Compose (recommended, lowest setup effort)

```bash
git clone ...
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/agent/.env.example apps/agent/.env.local
docker compose up
```

- Web: http://localhost:3000
- Agent API: http://localhost:2024

### Option B — Run web and agent independently on the host

```bash
npm install

# terminal 1
npm run dev:web       # or: cd apps/web && npm run dev

# terminal 2
npm run dev:agent     # or: cd apps/agent && npx langgraphjs dev

# both at once
npm run dev
```

When running natively, [apps/web](apps/web) reaches the agent via
`LANGGRAPH_API_URL=http://localhost:2024`. Inside Docker Compose the web
container instead uses `LANGGRAPH_API_URL=http://agent:2024` — see the root
[.env.example](.env.example) for details.

### 1. Install dependencies

```bash
npm install
```

### 2. Create your environment file

Copy the example file and fill in the required values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

You can get your workflow id from the [Agent Builder](https://platform.openai.com/agent-builder) interface, after clicking "Publish":

<img src="./apps/web/public/docs/workflow.jpg" width=500 />

You can get your OpenAI API key from the [OpenAI API Keys](https://platform.openai.com/api-keys) page.

### 3. Configure ChatKit credentials

Update `.env.local` with the variables that match your setup.

- `OPENAI_API_KEY` — This must be an API key created **within the same org & project as your Agent Builder**. If you already have a different `OPENAI_API_KEY` env variable set in your terminal session, that one will take precedence over the key in `.env.local` one (this is how a Next.js app works). So, **please run `unset OPENAI_API_KEY` (`set OPENAI_API_KEY=` for Windows OS) beforehand**.
- `NEXT_PUBLIC_CHATKIT_WORKFLOW_ID` — This is the ID of the workflow you created in [Agent Builder](https://platform.openai.com/agent-builder), which starts with `wf_...`
- (optional) `CHATKIT_API_BASE` - This is a customizable base URL for the ChatKit API endpoint

> Note: if your workflow is using a model requiring organization verification, such as GPT-5, make sure you verify your organization first. Visit your [organization settings](https://platform.openai.com/settings/organization/general) and click on "Verify Organization".

### 4. Run the app

```bash
npm run dev:web
```

Visit `http://localhost:3000` and start chatting. Use the prompts on the start screen to verify your workflow connection, then customize the UI or prompt list in [apps/web/lib/config.ts](apps/web/lib/config.ts) and [apps/web/components/ChatKitPanel.tsx](apps/web/components/ChatKitPanel.tsx).

### 5. Deploy your app

```bash
npm run build:web
```

`apps/web` deploys independently (e.g. to Vercel) from `apps/agent`, which
ships as its own Docker image — see [apps/agent/Dockerfile](apps/agent/Dockerfile).
Setting the deployed agent's URL as `LANGGRAPH_API_URL` for the deployed web
app connects the two in production.

Before deploying your app, you need to verify the domain by adding it to the [Domain allowlist](https://platform.openai.com/settings/organization/security/domain-allowlist) on your dashboard.

## Customization Tips

- Adjust starter prompts, greeting text, [chatkit theme](https://chatkit.studio/playground), and placeholder copy in [apps/web/lib/config.ts](apps/web/lib/config.ts).
- Update the event handlers inside [apps/web/components/ChatKitPanel.tsx](apps/web/components/ChatKitPanel.tsx) to integrate with your product analytics or storage.

## References

- [ChatKit JavaScript Library](http://openai.github.io/chatkit-js/)
- [Advanced Self-Hosting Examples](https://github.com/openai/openai-chatkit-advanced-samples)
