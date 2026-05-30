import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { AdminOnly } from "../../common/decorations/adminOnly.decoration";
import { GachaAdminService } from "./gachaadmin.service";

@ApiTags("gacha-admin")
@AdminOnly()
@Controller("api/v1/admin")
export class GachaAdminController {
  constructor(private readonly service: GachaAdminService) {}

  @Get("gacha/banners")
  async listBanners() {
    return { data: await this.service.listBanners() };
  }

  @Post("uploads/image")
  @UseInterceptors(FileInterceptor("file"))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.service.uploadImage(file);
    return { message: "image uploaded", data: result };
  }

  @Post("gacha/banners")
  async createBanner(@Body() body: any) {
    const banner = await this.service.createBanner({
      bannerCode: body.bannerCode,
      bannerName: body.bannerName,
      bannerImageUrl: body.bannerImageUrl || body.bannerImageData,
      playerId: Number(body.playerId),
      expiredAt: body.timeEnd,
      status: 1,
    });
    return { message: "banner created", data: banner };
  }
}
