import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { TeamFormationEntity } from './entities/team-formatition.entity';
import { CampainEntity } from '../campain/entities/campain.entity';
import { CampainMatchEntity } from '../campain/entities/campain-match.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
       UserEntity,
       TeamFormationEntity,
       CampainEntity,
       CampainMatchEntity
    ]),
  ],
  controllers: [ ],
  providers: [
  ],
})
export class TeamModule {}
