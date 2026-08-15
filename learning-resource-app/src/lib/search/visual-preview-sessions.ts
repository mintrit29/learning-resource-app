import { randomUUID } from "node:crypto";
import type { PreviewFileType } from "@/lib/documents/render-document-preview";

const SESSION_TTL_MS = 15 * 60 * 1_000;
const MAX_SESSIONS = 3;

type VisualPreviewSession = {
  id: string;
  buffer: Buffer;
  fileType: PreviewFileType;
  title: string;
  touchedAt: number;
};

type PreviewSessionGlobal = typeof globalThis & {
  scholarFlowVisualPreviewSessions?: Map<string, VisualPreviewSession>;
};

function sessions() {
  const shared = globalThis as PreviewSessionGlobal;
  shared.scholarFlowVisualPreviewSessions ??= new Map();
  return shared.scholarFlowVisualPreviewSessions;
}

function pruneExpiredSessions(now = Date.now()) {
  const activeSessions = sessions();
  for (const [id, session] of activeSessions) {
    if (now - session.touchedAt > SESSION_TTL_MS) activeSessions.delete(id);
  }
}

function makeRoomForSession() {
  const activeSessions = sessions();
  while (activeSessions.size >= MAX_SESSIONS) {
    const oldest = [...activeSessions.values()].sort((a, b) => a.touchedAt - b.touchedAt)[0];
    if (!oldest) break;
    activeSessions.delete(oldest.id);
  }
}

export function createVisualPreviewSession(buffer: Buffer, fileType: PreviewFileType, title: string) {
  pruneExpiredSessions();
  makeRoomForSession();
  const session: VisualPreviewSession = {
    id: randomUUID(),
    buffer,
    fileType,
    title,
    touchedAt: Date.now(),
  };
  sessions().set(session.id, session);
  return session;
}

export function getVisualPreviewSession(id: string) {
  pruneExpiredSessions();
  const session = sessions().get(id);
  if (session) session.touchedAt = Date.now();
  return session ?? null;
}

export function removeVisualPreviewSession(id: string) {
  return sessions().delete(id);
}
