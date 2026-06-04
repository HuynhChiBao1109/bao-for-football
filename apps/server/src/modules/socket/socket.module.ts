import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocketService } from './socket.service';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [AuthModule],
  providers: [SocketGateway, SocketService],
})
export class SocketModule {}
