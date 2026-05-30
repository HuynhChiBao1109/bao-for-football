import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class TacticsLineupSlotDto {
  @IsString()
  @IsNotEmpty()
  slotId!: string;

  @IsString()
  @IsNotEmpty()
  position!: string;

  @IsNumber()
  userPlayerId!: number;
}

export class TacticsGameplayDto {
  @IsNumber()
  @IsOptional()
  passSpeedScale?: number;

  @IsNumber()
  @IsOptional()
  interceptionRadius?: number;

  @IsNumber()
  @IsOptional()
  gkBuildUpBias?: number;

  @IsNumber()
  @IsOptional()
  tempoScale?: number;
}

export class SaveTacticsDto {
  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @IsString()
  @IsNotEmpty()
  formation!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  passRatio!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  shotRatio!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  pressure!: number;

  @IsString()
  @IsNotEmpty()
  mode!: string;

  @IsArray()
  lineup!: TacticsLineupSlotDto[];

  gameplay!: TacticsGameplayDto;
}
