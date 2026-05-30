import { IsInt, Min } from "class-validator";

export class AssignClubDto {
  @IsInt()
  @Min(1)
  clubId!: number;
}
