const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#06b6d4"];

export interface Identity {
  name: string;
  color: string;
}

export function getIdentity(): Identity {
  const stored = localStorage.getItem("draft_identity");
  if (stored) {
    try { return JSON.parse(stored) as Identity; }
    catch { /* fall through */ }
  }
  const identity: Identity = { name: "", color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  localStorage.setItem("draft_identity", JSON.stringify(identity));
  return identity;
}

export function setIdentityName(name: string): void {
  const identity = getIdentity();
  identity.name = name.trim();
  localStorage.setItem("draft_identity", JSON.stringify(identity));
}
