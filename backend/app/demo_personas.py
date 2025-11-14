from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil
from typing import Dict, List, Optional, Sequence, Set

from .schemas.user import UserMatchCandidate


BASE_DIR = Path(__file__).resolve().parents[2]
USER_IMAGE_DIR = BASE_DIR / "userimages"
UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class DemoPersona:
    id: str
    display_name: str
    tagline: str
    bio: str
    interests: Sequence[str]
    prompt: str
    compatibility_bias: float
    schedule_score: float
    personality_overlap: float
    photo_asset: Optional[str] = None


class DemoPersonaRegistry:
    """Static personas that act as AI-powered demo matches."""

    _PERSONAS: Sequence[DemoPersona] = (
        DemoPersona(
            id="demo-ava",
            display_name="Ava from Makerspace",
            tagline="Late-night prototyper who mixes robotics jams with lofi playlists.",
            bio=(
                "Runs the campus makerspace sprint nights, always balancing solder fumes with pour-over coffee."
            ),
            interests=["3d printing", "robotics", "coffee tastings", "lofi playlists", "campus pop-ups"],
            prompt=(
                "You are Ava, the upbeat makerspace lead who speaks in playful builder slang. "
                "You’re obsessed with rapid prototyping, 3D printers, and getting friends to co-work over lofi playlists. "
                "Keep responses practical but warm, mention specific tools or creative rituals, and occasionally reference the campus makerspace."
            ),
            compatibility_bias=0.78,
            schedule_score=0.82,
            personality_overlap=0.9,
            photo_asset="DemoAva.svg",
        ),
        DemoPersona(
            id="demo-leo",
            display_name="Leo from Outing Club",
            tagline="Trail guide who plans sunrise hikes and zero-waste picnics.",
            bio="Leads the outdoor leadership trips, journaling trail notes and scouting meteor showers.",
            interests=["trail runs", "sunrise hikes", "astro photography", "zero-waste cooking", "gear swaps"],
            prompt=(
                "You are Leo, the campus outing-club guide. You love dawn hikes, trail mix experiments, and "
                "encouraging friends to unplug. Speak with calm enthusiasm, weave in sensory outdoor details, "
                "and sprinkle gentle mindfulness tips."
            ),
            compatibility_bias=0.74,
            schedule_score=0.78,
            personality_overlap=0.84,
            photo_asset="DemoLeo.svg",
        ),
        DemoPersona(
            id="demo-priya",
            display_name="Priya from Campus Concerts",
            tagline="Pop-up concert curator who swaps playlists faster than the DJ booth rotates.",
            bio="Runs the campus concerts board, curating cozy listening parties and spontaneous dance breaks.",
            interests=["indie pop", "dj sets", "community organizing", "night markets", "storytelling"],
            prompt=(
                "You are Priya, the student who programs campus concerts and storytelling nights. "
                "You're energetic, witty, and reference music constantly. Drop casual mentions of playlists, "
                "crowd energy, or backstage chaos while staying supportive and collaborative."
            ),
            compatibility_bias=0.76,
            schedule_score=0.75,
            personality_overlap=0.88,
            photo_asset="DemoPriya.svg",
        ),
    )

    _LOOKUP: Dict[str, DemoPersona] = {persona.id: persona for persona in _PERSONAS}
    _LOOKUP_BY_NAME: Dict[str, DemoPersona] = {
        persona.display_name.lower(): persona for persona in _PERSONAS
    }

    @classmethod
    def list_personas(cls) -> Sequence[DemoPersona]:
        return cls._PERSONAS

    @classmethod
    def get(cls, identifier: Optional[str]) -> Optional[DemoPersona]:
        if not identifier:
            return None
        persona = cls._LOOKUP.get(identifier)
        if persona:
            return persona
        return cls._LOOKUP_BY_NAME.get(identifier.lower())

    @classmethod
    def build_matches(cls, *, user_interests: Set[str]) -> List[UserMatchCandidate]:
        """Return demo matches tailored to the viewer’s interests."""
        normalized_interests = {item.strip().lower() for item in user_interests if item}
        candidates: list[UserMatchCandidate] = []
        for persona in cls._PERSONAS:
            shared = cls._shared_interests(persona, normalized_interests)
            interest_union = normalized_interests | {interest.lower() for interest in persona.interests}
            interest_score = len(shared) / len(interest_union) if interest_union else 0.0
            compatibility = min(0.97, persona.compatibility_bias + (interest_score * 0.3))
            photo_url = ensure_demo_photo(persona.photo_asset, persona.id)
            candidates.append(
                UserMatchCandidate(
                    user_id=persona.id,
                    display_name=persona.display_name,
                    compatibility_score=round(compatibility, 3),
                    shared_interests=[cls._format_interest(value) for value in sorted(shared)],
                    schedule_score=round(persona.schedule_score, 3),
                    personality_overlap=round(persona.personality_overlap, 3),
                    bio=persona.bio,
                    tagline=persona.tagline,
                    photos=[photo_url] if photo_url else None,
                )
            )
        return candidates

    @staticmethod
    def _shared_interests(persona: DemoPersona, user_interests: Set[str]) -> Set[str]:
        return {interest.lower() for interest in persona.interests if interest.lower() in user_interests}

    @staticmethod
    def _format_interest(value: str) -> str:
        if not value:
            return value
        pieces = value.split()
        return " ".join(piece.capitalize() if not piece.isupper() else piece for piece in pieces)


def ensure_demo_photo(asset_name: Optional[str], persona_id: str) -> Optional[str]:
    if not asset_name:
        return None
    source = USER_IMAGE_DIR / asset_name
    if not source.exists():
        return None
    sanitized_id = persona_id.replace(" ", "-")
    dest_name = f"{sanitized_id}{source.suffix.lower()}"
    dest_path = UPLOADS_DIR / dest_name
    try:
        if not dest_path.exists() or source.stat().st_mtime > dest_path.stat().st_mtime:
            shutil.copyfile(source, dest_path)
    except OSError as exc:
        print(f"⚠️  Unable to copy demo photo for {persona_id}: {exc}")
        return None
    return f"/uploads/{dest_name}"
