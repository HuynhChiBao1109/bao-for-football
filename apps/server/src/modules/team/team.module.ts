import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { TeamFormationEntity } from './entities/team-formatition.entity';

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
