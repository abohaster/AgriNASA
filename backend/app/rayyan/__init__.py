"""
RAYAN — Google Gemini integration for AgriNASA.

This package is deliberately isolated from `app.ai`:
* `app.ai` is the existing deterministic explainer + optional OpenAI-compatible
  assistant. It is not imported, replaced or re-routed here.
* RAYAN owns its Gemini key store, encryption, provider client, prompt,
  response validation and API router.

Nothing in this package computes agronomy. It reuses the existing read-only
services (`environment`, `irrigation`, `crop_health`, `vegetation`) and the
existing `build_field_context` object so the model only explains values that
AgriNASA already calculated.
"""

__version__ = "1.0.0"
