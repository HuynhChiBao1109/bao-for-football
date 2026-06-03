import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class RegisterDTO {
  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password: string;
}
