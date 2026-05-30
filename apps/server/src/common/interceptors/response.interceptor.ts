import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    return next.handle().pipe(
      map((value: unknown) => {
        if (value === undefined) {
          return { data: null };
        }

        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          this.hasEnvelopeKeys(value as Record<string, unknown>)
        ) {
          return value;
        }

        return { data: value };
      }),
    );
  }

  private hasEnvelopeKeys(payload: Record<string, unknown>) {
    return [
      "data",
      "message",
      "error",
      "token",
      "user",
      "path",
      "timestamp",
    ].some((key) => key in payload);
  }
}
