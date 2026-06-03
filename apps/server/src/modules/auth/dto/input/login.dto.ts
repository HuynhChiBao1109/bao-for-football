import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password: string;
}
