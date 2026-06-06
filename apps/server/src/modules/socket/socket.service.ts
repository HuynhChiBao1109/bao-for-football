import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";
import { EmitRoomDTO } from "./dto/emit-room.dto";

@Injectable()
export class SocketService {
  private server: Server;

  setServer(server: Server) {
    console.log("Socket server initialized");
    this.server = server;
  }

  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }

  emitToRoom(data: EmitRoomDTO) {
    if (!this.server) {
      console.warn("Socket server not initialized yet");
      return;
    }
    const { roomId, event, data: eventData } = data;

    this.server.to(roomId).emit(event, eventData);
  }

  emitToSocket(socketId: string, event: string, data: any) {
    this.server.to(socketId).emit(event, data);
  }
}
