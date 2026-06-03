import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/user.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
       UserEntity
    ]),
  ],
  controllers: [ ],
  providers: [
  ],
})
export class TeamModule {}
