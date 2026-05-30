import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorations/public.decoration";

@Controller()
export class AppController {
  @Get("health")
  @Public()
  health() {
    return {
      service: "service-core",
      status: "ok",
    };
  }
}
