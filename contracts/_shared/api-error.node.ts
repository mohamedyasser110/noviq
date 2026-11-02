// Backend (Node.js) shared error — copy into e.g. src/shared/api-error.ts
// Express error middleware:
//   app.use((err, req, res, next) => {
//     if (err instanceof ApiError)
//       return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
//     res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error", details: null } });
//   });
export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static notFound(message = "Not found") { return new ApiError(404, "NOT_FOUND", message); }
  static validation(message = "Validation failed", details: unknown = null) {
    return new ApiError(400, "VALIDATION_ERROR", message, details);
  }
}