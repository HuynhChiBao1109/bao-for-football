import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { TokenClaims } from "../../modules/auth/types";

export const CurrentUser = createParamDecorator(
  (property: keyof TokenClaims | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: TokenClaims }>();
    const user = request.user;
    if (!property) {
      return user;
    }
    return user?.[property];
  },
);
