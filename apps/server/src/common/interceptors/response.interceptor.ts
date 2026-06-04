import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Response } from "express";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((value: unknown) => {
        const statusCode = response.statusCode || 200;
        let message = "success";
        let data: unknown = value ?? null;

        if (value && typeof value === "object" && !Array.isArray(value)) {
          const payload = value as Record<string, unknown>;

          if (typeof payload.message === "string" && payload.message.trim()) {
            message = payload.message;
          }

          if ("data" in payload) {
            data = payload.data ?? null;
          } else {
            const { message: _, status_code: __, ...rest } = payload;
            data = Object.keys(rest).length ? rest : null;
          }
        }

        return {
          status_code: statusCode,
          message,
          data,
        };
      }),
    );
  }
}
