"""Domain exceptions mapped to friendly HTTP responses in app.main."""


class AppError(Exception):
    """Base class for expected, user-presentable failures."""

    code = "APP_ERROR"
    status_code = 500

    def __init__(self, message: str, details: str | None = None):
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = 404


class ValidationFailure(AppError):
    """A domain validation failure (distinct from Pydantic 422 validation)."""

    code = "VALIDATION_ERROR"
    status_code = 422


class NASAUnavailable(AppError):
    code = "NASA_UNAVAILABLE"
    status_code = 502


class GeocodingUnavailable(AppError):
    code = "GEOCODING_UNAVAILABLE"
    status_code = 502


class GEEUnavailable(AppError):
    """Earth Engine is not configured, or the provider call failed safely."""

    code = "GEE_UNAVAILABLE"
    status_code = 503


class RateLimited(AppError):
    code = "RATE_LIMITED"
    status_code = 429
