import assert from "node:assert/strict";
import { OpenAIEmbeddingService } from "./embedding.js";

const requests: Array<{ body: Record<string, unknown> }> = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
  requests.push({ body });
  return new Response(
    JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}) as typeof fetch;

try {
  const service = new OpenAIEmbeddingService({
    provider: "openai",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiKey: "test-key",
    model: "nvidia/llama-nemotron-embed-vl-1b-v2",
    dimensions: 2048,
    inputType: "passage",
    modality: "text",
  });

  await service.embed("document memory");
  await service.embed("memory query", { inputType: "query" });

  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.body.input_type, "passage");
  assert.equal(requests[0]?.body.modality, "text");
  assert.equal(requests[1]?.body.input_type, "query");
  assert.equal(requests[1]?.body.modality, "text");
  assert.equal((requests[0]?.body.input as string[])[0], "document memory");
  assert.equal((requests[1]?.body.input as string[])[0], "memory query");

  console.log(JSON.stringify({ status: "PASS", request_count: requests.length }));
} finally {
  globalThis.fetch = originalFetch;
}
