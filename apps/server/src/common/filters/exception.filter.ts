import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";

@Catch()
export class GoExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "internal server error";
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse() as
        | { message?: string | string[]; error?: string }
        | string;
      if (typeof payload === "string") {
        message = payload;
      } else if (Array.isArray(payload?.message)) {
        message = payload.message.join(", ");
      } else if (typeof payload?.message === "string") {
        message = payload.message;
      } else if (typeof payload?.error === "string") {
        message = payload.error;
      } else if (exception.message) {
        message = exception.message;
      }
      stack = exception.stack;
    } else if (exception instanceof Error && exception.message) {
      message = exception.message;
      stack = exception.stack;
    }

    response.status(status).json({
      status_code: status,
      message,
      data: null,
      stack,
    });
  }
}
