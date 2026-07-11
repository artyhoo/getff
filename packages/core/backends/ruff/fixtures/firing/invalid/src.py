# Violates BOTH fast-path bans: a module-level `import torch` (TID253) and an import of the
# banned `requests` qualified name (TID251). Fires two codes under the rendered ruff.toml.
import torch
import requests


def main():
    return requests.get("https://example.com")
