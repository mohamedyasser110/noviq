/* ============================================================
   NOVIQ BACKEND — shared error helper (CommonJS port)
   ------------------------------------------------------------
   Mirrors contracts/_shared/api-error.node.ts (the contract-first
   source of truth). Generates code imports from there; this copy is
   what the CommonJS app actually requires. Envelope on every
   non-2xx: { error: { code, message, details } }.
   ============================================================ */

class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static validation(message = 'Validation failed', details = null) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthenticated(message = 'Authentication required.') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'Forbidden.') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static conflict(message = 'Conflict.') {
    return new ApiError(409, 'CONFLICT', message);
  }

  /* Express error middleware: ApiError -> its status+envelope,
     anything else -> 500 INTERNAL_ERROR. Replaces ad-hoc handlers. */
  static middleware() {
    // eslint-disable-next-line no-unused-vars
    return (err, req, res, _next) => {
      if (err instanceof ApiError) {
        return res.status(err.status).json({
          error: { code: err.code, message: err.message, details: err.details },
        });
      }
      console.error('[Server Error]', err.stack);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: null },
      });
    };
  }
}

module.exports = { ApiError };
