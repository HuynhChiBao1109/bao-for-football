import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampainEntity } from './entities/campain.entity';
import { CampainMatchEntity } from './entities/campain-match.entity';
import { TeamEntity } from '../team/entities/team.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            CampainEntity,
            CampainMatchEntity,
            TeamEntity
        ])
    ],
    controllers: [ ],
    providers: [
    ],
})
export class CampainModule {}
