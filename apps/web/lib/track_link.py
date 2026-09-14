"""
track_link.py — Python helper for building /r tracking redirect URLs.

Usage:
    from track_link import build_tracked_url

    url = build_tracked_url(
        "https://clinicaltrials.gov/study/NCT123",
        base_domain="https://trialchat.example.com",
        meta={
            "cta": "trial-card",
            "role": "caregiver",
            "intent": "trial_matching",
            "session_id": "abc123",
        },
    )
    # → "https://trialchat.example.com/r?to=https%3A%2F%2F...&meta=%7B...%7D"
"""

from __future__ import annotations

import json
import re
from typing import Literal, TypedDict
from urllib.parse import quote_plus, urlencode


class LinkMeta(TypedDict, total=False):
    cta: str
    role: Literal["user", "caregiver", "clinician"]
    intent: Literal["learn", "match", "trial_matching"]
    user_id: str
    session_id: str
    ref_page: str


_EXTERNAL_RE = re.compile(r"^(https?|tel|mailto):", re.IGNORECASE)


def build_tracked_url(
    raw_url: str,
    base_domain: str = "",
    meta: LinkMeta | dict | None = None,
) -> str:
    """
    Wrap an external URL in the /r tracking redirect.

    Args:
        raw_url:     The original destination URL (http/https/tel/mailto).
        base_domain: Optional domain prefix, e.g. "https://trialchat.example.com".
                     Leave empty to produce a root-relative path (/r?...).
        meta:        Optional metadata dict recorded alongside the click.

    Returns:
        Tracking URL string, or raw_url unchanged if it has no external protocol.
    """
    if not _EXTERNAL_RE.match(raw_url):
        return raw_url

    params: dict[str, str] = {"to": raw_url}
    if meta:
        params["meta"] = json.dumps(meta, separators=(",", ":"), ensure_ascii=False)

    query = urlencode(params, quote_via=quote_plus)
    return f"{base_domain}/r?{query}"
