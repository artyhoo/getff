# Violates all three fast-path bans: a module-level `import torch` (TID253), an import of the
# banned `requests` qualified name (TID251), and a `datetime.datetime.now(None)` call (DTZ005 —
# the naive-datetime middle case this umbrella closes). Fires three codes under the rendered ruff.toml.
import datetime
import torch
import requests


def main():
    requests.get("https://example.com")
    return datetime.datetime.now(None)
