import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { SocketService } from "./socket.service";
import { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";
import { AuthUser } from "../auth/types";
import { ESocketChannel } from "./enums";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly socketService: SocketService,
    private readonly authService: AuthService,
  ) {}

  afterInit(server: Server) {
    server.use(async (client, next) => {
      const token = this.extractToken(client);

      if (!token) {
        next(new Error("missing auth token"));
        return;
      }

      try {
        const claims = await this.authService.verifyToken(token);
        client.data.claims = claims;
        client.data.userId = this.normalizeUserId(claims.id);
        next();
      } catch {
        next(new Error("invalid auth token"));
      }
    });
  }

  handleConnection(client: Socket) {
    const userId = this.getUserId(client);

    if (!userId) {
      client.disconnect(true);
      return;
    }

    client.join(`${ESocketChannel.USER}${userId}`);
    this.logger.debug(`socket ${client.id} joined ${ESocketChannel.USER}${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = this.getUserId(client);

    if (userId) {
      this.logger.debug(`socket ${client.id} disconnected from ${ESocketChannel.USER}${userId}`);
    }
  }

  @SubscribeMessage("ping")
  handlePing(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    console.log("Ping:", data);

    return {
      event: "pong",
      data: "Hello FE",
    };
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === "string" && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = client.handshake.headers.authorization;

    if (typeof authorization !== "string") {
      return null;
    }

    const [prefix, token] = authorization.split(" ");

    if (prefix !== "Bearer" || !token) {
      return null;
    }

    return token;
  }

  private getUserId(client: Socket): string | null {
    if (typeof client.data.userId === "string" && client.data.userId) {
      return client.data.userId;
    }

    const claims = client.data.claims as AuthUser | undefined;

    if (!claims) {
      return null;
    }

    return this.normalizeUserId(claims.id);
  }

  private normalizeUserId(userId: AuthUser["id"]): string {
    return String(userId);
  }
}
