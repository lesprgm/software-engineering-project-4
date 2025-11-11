from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from ..config import Settings, get_settings

logger = logging.getLogger(__name__)


@dataclass
class ModerationResult:
    flagged: bool
    categories: list[str]
    severity: Optional[str] = None

    @property
    def metadata(self) -> dict:
        return {
            "flagged": self.flagged,
            "categories": self.categories,
            "severity": self.severity,
        }


class AIClient:
    """Wrapper around Gemini endpoints with graceful fallbacks."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def generate_text(
        self,
        prompt: str,
        *,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 400,
    ) -> str:
        if self.settings.gemini_api_key:
            try:
                return self._call_gemini(prompt, system_prompt, temperature)
            except Exception as exc:  # pragma: no cover - network failure path
                logger.warning("Gemini call failed, falling back to mock: %s", exc)
        return self._fallback(prompt)

    def moderate_text(self, content: str) -> ModerationResult:
        return self._heuristic_moderation(content)

    # --- Provider implementations -------------------------------------------------
    def _call_gemini(
        self,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
    ) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.settings.gemini_model}:generateContent"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": (system_prompt or self._default_system_prompt()) + "\n\n" + prompt}
                    ],
                }
            ],
            "generationConfig": {"temperature": temperature},
        }
        response = httpx.post(f"{url}?key={self.settings.gemini_api_key}", json=payload, timeout=20)
        response.raise_for_status()
        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            raise RuntimeError("Gemini returned no candidates")
        return candidates[0]["content"]["parts"][0]["text"].strip()

    # --- Fallbacks ----------------------------------------------------------------
    @staticmethod
    def _default_system_prompt() -> str:
        return (
            "You are Campus Connect's social concierge. "
            "Respond with concise, kind, and clear suggestions grounded in campus life."
        )

    def _fallback(self, prompt: str) -> str:
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:10]
        snippet = prompt.strip().splitlines()[0][:120] if prompt.strip() else "connection"
        return f"[mock-ai-{digest}] {snippet}"

    def _heuristic_moderation(self, content: str) -> ModerationResult:
        banned_keywords = ["hate crime", "kill", "suicide", "weapon"]
        lowered = content.lower()
        categories = [word for word in banned_keywords if word in lowered]
        return ModerationResult(flagged=bool(categories), categories=categories, severity="low")
