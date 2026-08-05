// Purpose: Consistent application errors with HTTP status codes for the error middleware.
export class AppError extends Error {
    statusCode;
    details;
    code;
    constructor(statusCode, message, details, code) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.code = code;
        this.name = "AppError";
    }
}
export function assertFound(value, message = "Resource not found") {
    if (value == null) {
        throw new AppError(404, message);
    }
    return value;
}
