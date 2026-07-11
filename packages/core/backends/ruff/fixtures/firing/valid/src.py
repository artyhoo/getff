# Same shape as the invalid fixture, but each banned import carries ruff's inline
# suppression escape hatch on its own line (the sanctioned path, s0-verified-facts).
import torch  # noqa: TID253
import requests  # noqa: TID251


def main():
    return requests.get("https://example.com")
