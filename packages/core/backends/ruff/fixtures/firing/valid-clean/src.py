# Genuinely conforming: never imports torch, never touches the banned `requests` API, no
# suppression comment, AND uses `datetime.now(timezone.utc)` (the timezone-aware remedy DTZ005
# prescribes) — proving the rendered ruff.toml is no-false-positive on code that simply does not
# violate the convention AND that the prescribed remedy stays GREEN (T7/T14 counter). Produces
# ZERO codes.
import datetime
import httpx


def main():
    now = datetime.datetime.now(datetime.timezone.utc)
    return httpx.get("https://example.com"), now
