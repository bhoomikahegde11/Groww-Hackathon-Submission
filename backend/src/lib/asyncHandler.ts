import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 doesn't forward rejected promises from async handlers to next().
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
