import { assertExists } from "@std/assert";

// Test the exported handlers from server.ts
Deno.test("server module loads correctly", async () => {
  // Test that the server module loads without errors
  const serverModule = await import("./server.ts");
  assertExists(serverModule.server);
  // Verify server is created
  assertExists(serverModule.server.setRequestHandler);
});
