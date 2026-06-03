import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { UserEntity } from "../user/entities/user.entity";
import { AuthUser } from "./types";
import { CryptoUtil } from "src/common/utils";

@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}


  async findUserByUserName(username: string): Promise<UserEntity> {
    return await this.userRepository.findOne({ where: { userName: username } });
  }

  async findUserById(id: bigint): Promise<UserEntity> {
    return await this.userRepository.findOne({ where: { id: id } });
  }

  async create({
    userName,
    password,
  }: {
    userName: string;
    password: string;
  }): Promise<AuthUser> {
    const salt = await CryptoUtil.generateSalt();
    const passwordHash = await CryptoUtil.generateHash(password, salt);

    const newUser = this.userRepository.create({
      userName,
      passwordHash,
      salt,
    });

    const savedUser = await this.userRepository.save(newUser);

    const { id, userName: savedUserName } = savedUser;

    return {
      id: Number(id),
      userName: savedUserName,
      isAdmin: false,
    };
  }
}
