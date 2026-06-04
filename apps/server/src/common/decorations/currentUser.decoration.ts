import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthUser } from "../../modules/auth/types";

export const CurrentUser = createParamDecorator(
  (property: keyof AuthUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!property) {
      return user;
    }
    return user?.[property];
  },
);
