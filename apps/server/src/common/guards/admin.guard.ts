import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_ADMIN_ONLY_KEY } from "../constants/auth.constants";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAdminOnly = this.reflector.getAllAndOverride<boolean>(
      IS_ADMIN_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isAdminOnly) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    if (!request.user?.isAdmin) {
      throw new ForbiddenException("admin access required");
    }
    return true;
  }
}
