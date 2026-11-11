import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    let serverUrl = "http://localhost:5000";
    if (typeof window !== "undefined") {
      if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        serverUrl = window.location.origin;
      }
    }
    if (process.env.NEXT_PUBLIC_SOCKET_URL && !process.env.NEXT_PUBLIC_SOCKET_URL.includes("localhost")) {
      serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    } else if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost")) {
      serverUrl = process.env.NEXT_PUBLIC_API_URL.replace("/api", "");
    }

    socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
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
