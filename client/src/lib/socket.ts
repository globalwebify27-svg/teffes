import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const serverUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ||
      "http://localhost:5000";

    socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      withCredentials: true,
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("[Socket.IO Client] Connected to server:", socket?.id);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket.IO Client] Connection warning:", err.message);
    });
  }

  return socket;
};
