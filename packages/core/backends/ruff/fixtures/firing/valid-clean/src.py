# Genuinely conforming: never imports torch, never touches the banned `requests` API, and
# carries no suppression comment — proving the rendered ruff.toml is no-false-positive on
# code that simply does not violate the convention. Produces ZERO codes.
import httpx


def main():
    return httpx.get("https://example.com")
