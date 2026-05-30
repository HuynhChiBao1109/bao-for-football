import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { RealtimeService } from "./realtime.service";
import {
  MATCH_LATEST_EVENT,
  MATCH_SUBSCRIBE_EVENT,
  MATCH_SUBSTITUTE_EVENT,
  MATCH_UPDATE_EVENT,
  MatchSubscriptionPayload,
  MatchSubstitutionPayload,
  RealtimeEnvelope,
} from "./realtime.events";

@WebSocketGateway({
  path: "/ws",
  cors: {
    origin: "*",
    credentials: false,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private unsubscribe?: () => void;

  @WebSocketServer()
  server!: Server;

  constructor(private readonly realtimeService: RealtimeService) {}

  afterInit() {
    this.unsubscribe = this.realtimeService.subscribe((message) => {
      this.forwardMessage(message);
    });
  }

  handleConnection(client: Socket) {
    const matchId = String(client.handshake.query.matchId ?? "");
    if (matchId) {
      this.joinMatchRoom(client, matchId);
      this.emitLatest(client, matchId);
    }
    this.logger.log(`client connected ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`client disconnected ${client.id}`);
  }

  @SubscribeMessage(MATCH_SUBSCRIBE_EVENT)
  onSubscribe(
    @MessageBody() body: MatchSubscriptionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (!body?.matchId) {
      return { error: "matchId is required" };
    }

    this.joinMatchRoom(client, body.matchId);
    this.emitLatest(client, body.matchId);
    return { ok: true };
  }

  @SubscribeMessage(MATCH_SUBSTITUTE_EVENT)
  onSubstitute(@MessageBody() body: MatchSubstitutionPayload) {
    if (!body?.matchId) {
      return { error: "matchId is required" };
    }

    return this.realtimeService.handleSubstitution(body);
  }

  private emitLatest(client: Socket, matchId: string) {
    const latest = this.realtimeService.latest(matchId);
    if (!latest) {
      return;
    }

    client.emit(MATCH_LATEST_EVENT, latest);
  }

  private joinMatchRoom(client: Socket, matchId: string) {
    client.join(this.matchRoom(matchId));
  }

  private forwardMessage(message: RealtimeEnvelope) {
    if (!this.server) {
      return;
    }

    if (message.matchId) {
      const room = this.matchRoom(message.matchId);
      this.server.to(room).emit(MATCH_UPDATE_EVENT, message);
      this.server.to(room).emit(message.event, message.data);
      return;
    }

    this.server.emit(MATCH_UPDATE_EVENT, message);
    this.server.emit(message.event, message.data);
  }

  private matchRoom(matchId: string) {
    return `match:${matchId}`;
  }
}
