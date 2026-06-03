import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/user.entities';
import { TeamFormationEntity } from './entities/team-formatition.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
       UserEntity,
       TeamFormationEntity,
    ]),
  ],
  controllers: [ ],
  providers: [
  ],
})
export class TeamModule {}
