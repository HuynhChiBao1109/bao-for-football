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
  ],
  controllers: [ ],
  providers: [
    TeamRepository,
    TeamService,
  ],
  exports: [TeamService],
})
export class TeamModule {}
