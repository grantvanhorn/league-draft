import { useEffect, useRef } from "react";
import { socket } from "../lib/socket";
import { getIdentity } from "../lib/identity";
import { getDraft } from "../lib/api";
import type { DraftState } from "../types";

export interface PresenceUser {
  name: string;
  color: string;
}

export function useDraftSync(
  draftId: string | null,
  onUpdate: (d: DraftState) => void,
  onDeleted: (id: string) => void,
  onPresence: (users: PresenceUser[]) => void
) {
  const onUpdateRef = useRef(onUpdate);
  const onDeletedRef = useRef(onDeleted);
  const onPresenceRef = useRef(onPresence);

  useEffect(() => { onUpdateRef.current = onUpdate; });
  useEffect(() => { onDeletedRef.current = onDeleted; });
  useEffect(() => { onPresenceRef.current = onPresence; });

  useEffect(() => {
    if (!draftId) return;

    const handleUpdate = (d: DraftState) => onUpdateRef.current(d);
    const handleDeleted = (id: string) => onDeletedRef.current(id);
    const handlePresence = (users: PresenceUser[]) => onPresenceRef.current(users);

    const joinRoom = () => {
      const identity = getIdentity();
      socket.emit("join:draft", { draftId, ...identity });
    };

    joinRoom();
    socket.on("draft:updated", handleUpdate);
    socket.on("draft:deleted", handleDeleted);
    socket.on("presence:updated", handlePresence);

    function handleReconnect() {
      joinRoom();
      getDraft(draftId!).then(handleUpdate).catch(() => {});
    }
    socket.on("connect", handleReconnect);

    return () => {
      socket.emit("leave:draft", draftId);
      socket.off("draft:updated", handleUpdate);
      socket.off("draft:deleted", handleDeleted);
      socket.off("presence:updated", handlePresence);
      socket.off("connect", handleReconnect);
    };
  }, [draftId]);
}
