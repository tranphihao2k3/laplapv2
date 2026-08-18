import { app } from "electron";
import path from "node:path";
import Store from "electron-store";

export interface StoredSession {
  sid: string;
  uploadUrl: string;
  webUrl: string;
  expiresAt: string;
  importedAt: string;
}

interface SessionSchema {
  session: StoredSession | null;
}

const store = new Store<SessionSchema>({
  name: "session",
  defaults: { session: null },
});

export function getStoredSession(): StoredSession | null {
  return store.get("session");
}

export function setStoredSession(session: StoredSession): void {
  store.set("session", session);
}

export function clearStoredSession(): void {
  store.set("session", null);
}

export function sessionPath(): string {
  return path.join(app.getPath("userData"), "session.json");
}