import { Server } from "socket.io";
import type { Server as HttpServer } from "http";

export let io: Server;

interface UserPresence {
  name: string;
  color: string;
}

// Map<draftId, Map<socketId, UserPresence>>
const rooms = new Map<string, Map<string, UserPresence>>();

export function initIO(httpServer: HttpServer) {
  io = new Server(httpServer, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    socket.on("join:draft", ({ draftId, name, color }: { draftId: string; name: string; color: string }) => {
      socket.join(`draft:${draftId}`);
      if (!rooms.has(draftId)) rooms.set(draftId, new Map());
      rooms.get(draftId)!.set(socket.id, { name, color });
      io.to(`draft:${draftId}`).emit("presence:updated", [...rooms.get(draftId)!.values()]);
    });

    socket.on("leave:draft", (draftId: string) => {
      socket.leave(`draft:${draftId}`);
      rooms.get(draftId)?.delete(socket.id);
      io.to(`draft:${draftId}`).emit("presence:updated", [...(rooms.get(draftId)?.values() ?? [])]);
    });

    socket.on("update:identity", ({ name, color }: UserPresence) => {
      for (const room of socket.rooms) {
        if (!room.startsWith("draft:")) continue;
        const draftId = room.slice(6);
        rooms.get(draftId)?.set(socket.id, { name, color });
        io.to(room).emit("presence:updated", [...(rooms.get(draftId)?.values() ?? [])]);
      }
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (!room.startsWith("draft:")) continue;
        const draftId = room.slice(6);
        rooms.get(draftId)?.delete(socket.id);
        io.to(room).emit("presence:updated", [...(rooms.get(draftId)?.values() ?? [])]);
      }
    });
  });

  return io;
}
