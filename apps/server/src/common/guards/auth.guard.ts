import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "../../modules/auth/auth.service";
import { IS_PUBLIC_KEY } from "../constants/auth.constant";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;

    if (!authorization) {
      throw new UnauthorizedException("missing authorization header");
    }

    const [prefix, token] = authorization.split(" ");
    if (!prefix || prefix.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("invalid authorization header");
    }

    const claims = await this.authService.verifyToken(token);
    if (!claims) {
      throw new UnauthorizedException("invalid token");
    }
    request.user = claims;
    return true;
  }
}
