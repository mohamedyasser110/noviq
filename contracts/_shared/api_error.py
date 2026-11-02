"""Backend (FastAPI) shared error — copy into e.g. app/api_error.py
Register on the app:
    from app.api_error import register_api_error_handler
    register_api_error_handler(app)
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict | None = None):
        self.status = status
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def register_api_error_handler(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error_handler(request, exc: ApiError):
        return JSONResponse(
            status_code=exc.status,
            content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        )

    @app.exception_handler(HTTPException)
    async def _http_error_handler(request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status,
            content={"error": {"code": "HTTP_ERROR", "message": str(exc.detail), "details": None}},
        )