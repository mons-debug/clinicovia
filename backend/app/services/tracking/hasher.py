"""PII hashing for ad platform conversion APIs.

All platforms require SHA-256 hashed user data with specific normalization:
- Email: lowercase, trim whitespace
- Phone: digits only with country code (no +), trim whitespace
- Names: lowercase, trim whitespace
- City/Country: lowercase, trim whitespace
"""

import hashlib
import re


def _sha256(value: str) -> str:
    """SHA-256 hash a normalized string."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_email(email: str | None) -> str | None:
    """Normalize and hash an email address."""
    if not email:
        return None
    normalized = email.strip().lower()
    return _sha256(normalized)


def hash_phone(phone: str | None, country_code: str = "") -> str | None:
    """Normalize and hash a phone number. Strips non-digits, ensures country code."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", f"{country_code}{phone}")
    if not digits:
        return None
    return _sha256(digits)


def hash_name(name: str | None) -> str | None:
    """Normalize and hash a name (first or last)."""
    if not name:
        return None
    normalized = name.strip().lower()
    return _sha256(normalized)


def hash_city(city: str | None) -> str | None:
    """Normalize and hash a city name."""
    if not city:
        return None
    normalized = re.sub(r"[^a-z]", "", city.strip().lower())
    return _sha256(normalized)


def hash_country(country: str | None) -> str | None:
    """Normalize and hash a country code (2-letter ISO)."""
    if not country:
        return None
    normalized = country.strip().lower()[:2]
    return _sha256(normalized)


def build_hashed_user_data(
    email: str | None = None,
    phone: str | None = None,
    phone_country_code: str = "",
    first_name: str | None = None,
    last_name: str | None = None,
    city: str | None = None,
    country: str | None = None,
) -> dict:
    """Build a hashed user data dict for ad platform APIs.

    Returns only fields that have values (omits None).
    Keys use platform-standard abbreviations: em, ph, fn, ln, ct, country.
    """
    data: dict = {}

    em = hash_email(email)
    if em:
        data["em"] = em

    ph = hash_phone(phone, phone_country_code)
    if ph:
        data["ph"] = ph

    fn = hash_name(first_name)
    if fn:
        data["fn"] = fn

    ln = hash_name(last_name)
    if ln:
        data["ln"] = ln

    ct = hash_city(city)
    if ct:
        data["ct"] = ct

    co = hash_country(country)
    if co:
        data["country"] = co

    return data
