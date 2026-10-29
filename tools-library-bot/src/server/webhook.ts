/*
 * ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
 * Copyright (C) 2026  Chris Sanders
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import type { Server } from "node:http";
import type { MatrixClient } from "matrix-bot-sdk";
import { config } from "../config";
import { markWebhookListening } from "../runtime";
import { routeInboundMessage } from "../triage/triageEngine";
import { isSecretValid, isRateAllowed } from "./guards";

/**
 * Website integration — lightweight webhook server.
 *
 * The Next.js support text box POSTs { userIdentifier, message } to
 * /api/web-support. The same deterministic triage engine used for the Matrix
 * Help Desk room classifies the message: keyword matches are answered with
 * the scripted response (returned in the HTTP response for the website to
 * display), and anything unmatched is forwarded to the private admin room.
 *
 * Privacy: request bodies are never logged — not to disk, not to the console.
 */

interface WebSupportPayload {
  userIdentifier?: unknown;
  message?: unknown;
}

interface WebSupportResponse {
  success: boolean;
  autoResolved?: boolean;
  escalated?: boolean;
  intent?: string;
  reply?: string;
  error?: string;
}

function readString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function startWebhook(client: MatrixClient): Server {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  app.post("/api/web-support", (req: Request, res: Response): void => {
    void (async (): Promise<void> => {
      // Access control: shared secret (when configured) and a per-IP rate
      // limit, so the webhook cannot be used to flood the admin room.
      const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
      if (!isSecretValid(req.headers["x-webhook-secret"])) {
        res.status(401).json({ success: false, error: "unauthorized" });
        return;
      }
      if (!isRateAllowed(ip)) {
        res.status(429).json({ success: false, error: "rate-limited" });
        return;
      }

      const payload = (req.body ?? {}) as WebSupportPayload;
      const message = readString(payload.message, 2000);
      const userIdentifier = readString(payload.userIdentifier, 80) || "guest";

      if (message.length === 0) {
        const body: WebSupportResponse = { success: false, error: "message is required" };
        res.status(400).json(body);
        return;
      }

      try {
        const triage = await routeInboundMessage(client, "website", userIdentifier, undefined, message);
        const body: WebSupportResponse = {
          success: true,
          autoResolved: triage.autoResolved,
          escalated: triage.escalated,
          intent: triage.intent,
          reply: triage.replyText,
        };
        res.status(200).json(body);
      } catch (error) {
        console.error(
          "[webhook] triage failed:",
          error instanceof Error ? error.message : error
        );
        const body: WebSupportResponse = { success: false, error: "triage-failed" };
        res.status(500).json(body);
      }
    })();
  });

  app.get("/health", (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true, uptimeSeconds: Math.floor(process.uptime()) });
  });

  app.use((_req: Request, res: Response): void => {
    res.status(404).json({ success: false, error: "not-found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    console.error(
      "[webhook] unhandled error:",
      error instanceof Error ? error.message : error
    );
    res.status(500).json({ success: false, error: "internal-error" });
  });

  const server = app.listen(config.port, () => {
    markWebhookListening(config.port);
    console.log(`[webhook] listening on port ${config.port} (POST /api/web-support)`);
  });

  server.on("error", (error: NodeJS.ErrnoException): void => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `[webhook] port ${config.port} is already in use (is the Next.js dev server running on the same machine?). Set PORT in .env to a free port and restart.`
      );
    } else {
      console.error(`[webhook] server error: ${error.message}`);
    }
    process.exit(1);
  });

  return server;
}
