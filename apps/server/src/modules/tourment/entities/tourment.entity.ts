import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { AbstractEntity } from "src/database/database.abjact";

@Entity("tourments")
export class TeamEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "int", unsigned: true })
  id: number;
}
