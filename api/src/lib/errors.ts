// Purpose: Consistent application errors with HTTP status codes for the error middleware.
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function assertFound<T>(value: T | null | undefined, message = "Resource not found"): T {
  if (value == null) {
    throw new AppError(404, message);
  }
  return value;
}
