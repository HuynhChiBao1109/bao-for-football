import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { TeamEntity } from './entities/team.entity';
import { TeamFormationEntity } from './entities/team-formatition.entity';
import { CampainEntity } from '../campain/entities/campain.entity';
import { CampainMatchEntity } from '../campain/entities/campain-match.entity';
import { TeamRepository } from './team.repository';
import { TeamService } from './team.service';
import { ReferenceModule } from '../reference/reference.module';
import { PlayerModule } from '../player/player.module';
import { TeamController } from './team.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
       UserEntity,
       TeamEntity,
       TeamFormationEntity,
       CampainEntity,
       CampainMatchEntity
    ]),
    ReferenceModule,
    PlayerModule,
  ],
  controllers: [ TeamController],
  providers: [
    TeamRepository,
    TeamService,
  ],
  exports: [TeamService],
})
export class TeamModule {}
