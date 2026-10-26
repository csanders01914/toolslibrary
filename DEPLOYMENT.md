# DEPLOYMENT.md — Fedora CoreOS Rootless Podman Deployment

This guide deploys the Tool Library as a rootless Podman container on a local
Fedora CoreOS (FCOS) server. The stack is fully self-hosted: SQLite in WAL mode
on a single persistent volume, zero external CDNs, zero analytics, zero IP
logging.

## Prerequisites

- Fedora CoreOS server with `podman` installed (rootless mode enabled).
- The repository source code on the server (e.g. `git clone` into
  `/var/home/core/srv/tool-library`).
- OpenSSL available for generating the `AUTH_SECRET`.

## 1. Prepare the persistent data volume

The SQLite database (`tool_library.db`) and user media uploads live in a single
host directory that is bind-mounted into the container:

```bash
mkdir -p /var/home/core/srv/tool-library/data/uploads
```

## 2. Build the image

The `Containerfile` builds a Next.js `output: 'standalone'` image on
`node:20-alpine`, generates the Prisma client, and produces a production
server:

```bash
podman build -t localhost/tool-library:latest -f Containerfile .
```

## 3. Run the container (rootless, keep-id)

```bash
podman run -d \
  --name tool-library \
  --restart always \
  --userns=keep-id \
  --network host \
  -e DATABASE_URL="file:/app/data/tool_library.db" \
  -e AUTH_SECRET="$(openssl rand -hex 32)" \
  -e AUTH_TRUST_HOST="true" \
  -e AI_INFERENCE_URL="https://openrouter.ai/api/v1/chat/completions" \
  -e AI_INFERENCE_KEY="your-api-key" \
  -e AI_MODEL_NAME="qwen/qwen-2.5-7b-instruct" \
  -v /var/home/core/srv/tool-library/data:/app/data:Z \
  localhost/tool-library:latest
```

Notes:

- `--userns=keep-id` maps your host UID into the container so the bind-mounted
  `data/` volume stays owned by the same user (rootless requirement).
- `:Z` applies the SELinux private volume label required on FCOS.
- `--network host` binds the app directly to port `3000` on the host.
- On first start the entrypoint runs `prisma db push --skip-generate` to create
  or migrate the SQLite schema, then launches `node server.js`.
- `AI_INFERENCE_URL`, `AI_INFERENCE_KEY`, and `AI_MODEL_NAME` are only a
  legacy fallback. The primary configuration now lives in the app:
  **Admin Console → AUTOMATION CONFIGURATION** lets an admin pick a provider
  (OpenRouter, OpenAI, DeepSeek, Z.ai/GLM, local Ollama, or a custom
  chat-completions endpoint), set the model id, and store the API key —
  which is encrypted at rest with AES-256-GCM (key material derived from
  `AUTH_SECRET`, or set `LLM_ENCRYPTION_KEY` to use a dedicated master
  secret) and is never returned to the browser. The operations console
  and the help-ticket auto-dispatch both use this configuration. If no
  in-app config exists, the environment variables above are used.

## 4. Verify

```bash
podman ps                          # container should be Up
podman logs -f tool-library        # watch prisma db push + server boot
curl -s http://localhost:3000      # landing page HTML
```

The first account registered on an empty database automatically receives the
`ADMIN` role. Register immediately after the first boot to claim it.

## 5. Maintenance

- **Backups:** stop writes, then copy the whole `data/` directory
  (`tool_library.db`, `-wal`, `-shm`, and `uploads/`).
- **Schema changes:** update `prisma/schema.prisma`, rebuild the image, and
  restart — the entrypoint re-runs `prisma db push` on boot.
- **Logs:** `podman logs tool-library` (the app logs errors only; no IP or
  request logging).
- **Update:** `git pull`, `podman build -t localhost/tool-library:latest -f Containerfile .`,
  then `podman stop tool-library && podman rm tool-library` and re-run the
  `podman run` command above.
