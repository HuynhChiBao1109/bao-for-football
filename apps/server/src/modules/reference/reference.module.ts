import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubEntity } from './entities/club.entity.';
import { CountryEntity } from './entities/country.entity';
import { LeagueEntity } from './entities/league.entity';
import { ReferenceRepository } from './reference.repository';
import { ReferenceService } from './reference.service';

@Module({
        imports: [
            TypeOrmModule.forFeature([ClubEntity, LeagueEntity, CountryEntity]),
        ],
    controllers: [],
        providers: [ReferenceRepository, ReferenceService],
        exports: [ReferenceService],
})
export class ReferenceModule {}
