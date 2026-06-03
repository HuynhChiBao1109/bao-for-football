import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;
}
