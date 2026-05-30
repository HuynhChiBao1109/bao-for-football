import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();

    response.on("finish", () => {
      const duration = Date.now() - startedAt;
      this.logger.log(
        `${request.method} ${request.originalUrl} ${response.statusCode} ${duration}ms`,
      );
    });

    next();
  }
}
