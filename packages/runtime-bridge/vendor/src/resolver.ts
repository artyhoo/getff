/**
 * Preference resolver — selects the active RuntimeBackend at session start.
 *
 * Resolution order:
 *   1. RUNTIME_BRIDGE_MODE env var override (manual / aif-handoff / auto)
 *   2. If "auto": probe available() on each backend in order
 *      [aif-handoff, manual]  (amux added in Phase 2 SW-F)
 *   3. ManualBackend is always the tail — never excluded.
 *
 * Reads RUNTIME_BRIDGE_AIF_PROJECT_ID + RUNTIME_BRIDGE_AIF_URL (REST/WS, :3009)
 * for AifHandoffBackend configuration. RUNTIME_BRIDGE_AIF_MCP_URL (:3100) is
 * read into config but RESERVED for the MCP-target phase (unused by REST dispatch).
 *
 * @dual-pair: runtime-bridge-types
 */
import { AifHandoffBackend } from './AifHandoffBackend.js';
import { ManualBackend } from './ManualBackend.js';
import type { RuntimeBackend } from './backend.js';

/** Valid values for RUNTIME_BRIDGE_MODE env var. */
export type BridgeMode = 'auto' | 'manual' | 'aif-handoff' | 'amux';

/** Options to override defaults (useful in tests). */
export interface ResolverOptions {
  mode?: BridgeMode;
  aifBaseUrl?: string;
  /** MCP (HTTP) URL — RESERVED for the MCP-target phase; unused by REST dispatch. */
  aifMcpUrl?: string;
  aifProjectId?: string;
  /** Dependency injection: override backend constructors for testing. */
  backends?: RuntimeBackend[];
}

/**
 * Resolve the active backend based on env / options.
 *
 * @param options Optional overrides (for testing / programmatic use).
 * @returns The first available backend, or ManualBackend as fallback.
 */
export async function resolveBackend(options: ResolverOptions = {}): Promise<RuntimeBackend> {
  const mode = (options.mode ??
    (process.env['RUNTIME_BRIDGE_MODE'] as BridgeMode | undefined) ??
    'auto') as BridgeMode;

  const aifBaseUrl = options.aifBaseUrl ?? process.env['RUNTIME_BRIDGE_AIF_URL'];
  const aifMcpUrl = options.aifMcpUrl ?? process.env['RUNTIME_BRIDGE_AIF_MCP_URL'];
  const aifProjectId = options.aifProjectId ?? process.env['RUNTIME_BRIDGE_AIF_PROJECT_ID'];

  const manualBackend = new ManualBackend();

  // If caller injected explicit backends (tests), use them directly.
  if (options.backends) {
    return options.backends[0] ?? manualBackend;
  }

  if (mode === 'manual') {
    return manualBackend;
  }

  const aifBackend = new AifHandoffBackend({
    baseUrl: aifBaseUrl,
    mcpUrl: aifMcpUrl,
    projectId: aifProjectId,
  });

  if (mode === 'aif-handoff') {
    if (await aifBackend.available()) {
      return aifBackend;
    }
    process.stderr.write(
      '[runtime-bridge] RUNTIME_BRIDGE_MODE=aif-handoff but aif-handoff is unavailable — falling back to ManualBackend\n',
    );
    return manualBackend;
  }

  if (mode === 'amux') {
    // Phase 2 — amux backend not yet implemented.
    process.stderr.write(
      '[runtime-bridge] RUNTIME_BRIDGE_MODE=amux is reserved for Phase 2 — falling back to ManualBackend\n',
    );
    return manualBackend;
  }

  // auto: probe in order [aif-handoff, manual]
  // amux probe position added in Phase 2 SW-F.
  if (await aifBackend.available()) {
    return aifBackend;
  }

  return manualBackend;
}
