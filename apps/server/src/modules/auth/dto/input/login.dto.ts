import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDTO {
  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password: string;
}
