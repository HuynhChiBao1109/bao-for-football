import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

const TACTIC_COLUMNS = [
  new TableColumn({ name: "mentality", type: "varchar", length: "32", default: "'balanced'" }),
  new TableColumn({ name: "defensive_width", type: "tinyint", unsigned: true, default: 5 }),
  new TableColumn({ name: "defensive_depth", type: "tinyint", unsigned: true, default: 5 }),
  new TableColumn({ name: "build_up_play", type: "varchar", length: "32", default: "'balanced'" }),
  new TableColumn({ name: "chance_creation", type: "varchar", length: "32", default: "'balanced'" }),
  new TableColumn({ name: "attacking_width", type: "tinyint", unsigned: true, default: 5 }),
  new TableColumn({ name: "players_in_box", type: "tinyint", unsigned: true, default: 5 }),
  new TableColumn({ name: "corners", type: "tinyint", unsigned: true, default: 3 }),
  new TableColumn({ name: "free_kicks", type: "tinyint", unsigned: true, default: 3 }),
];

export class AddTeamTactics1787232000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("teams");
    if (!table) return;

    for (const column of TACTIC_COLUMNS) {
      if (!table.findColumnByName(column.name)) {
        await queryRunner.addColumn("teams", column);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("teams");
    if (!table) return;

    for (const column of [...TACTIC_COLUMNS].reverse()) {
      if (table.findColumnByName(column.name)) {
        await queryRunner.dropColumn("teams", column.name);
      }
    }
  }
}
