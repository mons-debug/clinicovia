"""Small Redis helpers for read-through API caching."""

import json
from typing import Any

import redis.asyncio as redis

from app.config import settings


_redis_client: redis.Redis | None = None


def get_redis_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def cache_get_json(key: str) -> Any | None:
    try:
        raw = await get_redis_client().get(key)
    except Exception:
        return None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int = 30) -> None:
    try:
        await get_redis_client().setex(key, ttl_seconds, json.dumps(value, default=str))
    except Exception:
        return


async def cache_delete_pattern(pattern: str) -> None:
    try:
        client = get_redis_client()
        async for key in client.scan_iter(match=pattern, count=100):
            await client.delete(key)
    except Exception:
        return
