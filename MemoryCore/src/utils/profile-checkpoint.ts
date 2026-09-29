import path from "node:path";
import { CheckpointManager } from "./checkpoint.js";
import {
  createScopedStorageAdapter,
  type StorageAdapter,
} from "../core/storage/adapter.js";
import { DEFAULT_PROFILE_SCOPE } from "../core/profile/profile-scope.js";
import type { Logger } from "../core/types.js";

export interface ProfileL1Progress {
  processedMessages: number;
  storedMemories: number;
}

function profileStoragePrefix(scope: string): string {
  return `profiles/${encodeURIComponent(scope)}/`;
}

function profileDataDir(dataDir: string, scope: string): string {
  return scope === DEFAULT_PROFILE_SCOPE
    ? dataDir
    : path.join(dataDir, "profiles", encodeURIComponent(scope));
}

function profileStorage(storage: StorageAdapter | undefined, scope: string): StorageAdapter | undefined {
  if (!storage || scope === DEFAULT_PROFILE_SCOPE) return storage;
  return createScopedStorageAdapter(storage, profileStoragePrefix(scope));
}

/**
 * Mirror L1 aggregate progress into each non-global profile checkpoint.
 *
 * The global checkpoint owns the L1 cursor and is updated separately by the
 * runner. L2/L3 use profile-scoped storage, so PersonaTrigger must see the
 * corresponding counters in that same scope.
 */
export async function updateProfileL1Checkpoints(opts: {
  pluginDataDir: string;
  storage?: StorageAdapter;
  profileProgress: Map<string, ProfileL1Progress>;
  logger: Logger;
  checkpointLock?: import("./checkpoint.js").CheckpointLockOptions;
}): Promise<void> {
  for (const [scope, progress] of opts.profileProgress) {
    // In legacy/global mode the global checkpoint was already updated by the
    // normal markL1ExtractionComplete() call. Updating it again would count
    // the same batch twice.
    if (scope === DEFAULT_PROFILE_SCOPE) continue;
    if (progress.processedMessages <= 0 && progress.storedMemories <= 0) continue;

    const checkpoint = new CheckpointManager(
      profileDataDir(opts.pluginDataDir, scope),
      opts.logger,
      profileStorage(opts.storage, scope),
      opts.checkpointLock,
    );
    await checkpoint.markProfileL1Progress(
      progress.processedMessages,
      progress.storedMemories,
    );
  }
}
