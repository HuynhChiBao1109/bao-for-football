import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class GoExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "internal server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse() as
        | { message?: string | string[] }
        | string;
      if (typeof payload === "string") {
        message = payload;
      } else if (Array.isArray(payload?.message)) {
        message = payload.message.join(", ");
      } else if (typeof payload?.message === "string") {
        message = payload.message;
      } else if (exception.message) {
        message = exception.message;
      }
    } else if (exception instanceof Error && exception.message) {
      message = exception.message;
    }

    response.status(status).json({
      error: message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
