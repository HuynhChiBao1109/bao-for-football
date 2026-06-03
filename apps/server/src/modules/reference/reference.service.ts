import { Injectable } from "@nestjs/common";
import { TeamRepository } from "./reference.repository";
import { TeamEntity } from "./entities/team.entity";
import { IReferenceService } from "./interfaces/reference-service.interface";

@Injectable()
export class ReferenceService implements IReferenceService {
  constructor(private readonly repository: TeamRepository) {}

  async getListClubDefault(): Promise<any> {}
}
