import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password!: string;
}
