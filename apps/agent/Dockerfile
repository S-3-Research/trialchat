# apps/agent/Dockerfile
# Standalone LangGraph Agent Server image — independent from apps/web.
FROM node:20-slim AS base
WORKDIR /repo

# Install deps at the workspace root so npm workspaces resolve correctly.
# (apps/agent has no remaining workspace-internal dependencies, but this
# keeps parity with how it's installed via the root lockfile.)
COPY package.json package-lock.json ./
COPY apps/agent/package.json apps/agent/package.json
RUN npm ci --workspace=apps/agent --include-workspace-root

COPY apps/agent apps/agent

WORKDIR /repo/apps/agent

EXPOSE 2024

# `langgraphjs up` shells out to its own docker-compose (needs the docker
# socket), so it's not suitable as the container's main process. Use the
# in-memory dev server bound to all interfaces instead — swap this for a
# proper production entrypoint (e.g. LangGraph Cloud / self-hosted server)
# once persistence via Postgres checkpointer is wired up.
CMD ["npx", "langgraphjs", "dev", "--host", "0.0.0.0", "--port", "2024", "--no-browser"]
