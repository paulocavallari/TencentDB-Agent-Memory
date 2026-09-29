import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CheckpointManager } from "./checkpoint.js";
import { updateProfileL1Checkpoints } from "./profile-checkpoint.js";

const logger = {
  info() {},
  debug() {},
  warn() {},
  error() {},
};

describe("profile-scoped L1 checkpoint progress", () => {
  it("propagates processed messages and new memories to the profile checkpoint", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tdai-l3-profile-"));
    const scope = "team:team-test|agent:agent-test";

    try {
      await updateProfileL1Checkpoints({
        pluginDataDir: root,
        profileProgress: new Map([[scope, { processedMessages: 2, storedMemories: 1 }]]),
        logger,
      });

      const profileDir = path.join(root, "profiles", encodeURIComponent(scope));
      const checkpoint = await new CheckpointManager(profileDir, logger).read();

      expect(checkpoint.total_processed).toBe(2);
      expect(checkpoint.total_memories_extracted).toBe(1);
      expect(checkpoint.memories_since_last_persona).toBe(1);
      expect(checkpoint.scenes_processed).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("does not double-count the global checkpoint", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tdai-l3-global-"));

    try {
      const rootCheckpoint = new CheckpointManager(root, logger);
      await rootCheckpoint.markL1ExtractionComplete("session-test", 1, 100);

      await updateProfileL1Checkpoints({
        pluginDataDir: root,
        profileProgress: new Map([["global", { processedMessages: 2, storedMemories: 1 }]]),
        logger,
      });

      const checkpoint = await rootCheckpoint.read();
      expect(checkpoint.total_processed).toBe(0);
      expect(checkpoint.total_memories_extracted).toBe(1);
      expect(checkpoint.memories_since_last_persona).toBe(1);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
