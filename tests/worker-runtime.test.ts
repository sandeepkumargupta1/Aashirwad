import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import vinext from "vinext";
import { workerSafeDevRuntime } from "../scripts/vite/worker-safe-runtime.mjs";

test("Vite runtime guards survive the development transform and work without window", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "aashirwad-worker-test-"));
  const server = await createServer({
    cacheDir,
    configFile: false,
    plugins: [vinext(), workerSafeDevRuntime()],
    server: { middlewareMode: true },
    logLevel: "silent",
  });
  try {
    const result = await server.environments.client.transformRequest("/@vite/client");
    assert.ok(result);
    const start = result.code.indexOf("let willUnload = false;");
    const end = result.code.indexOf("function cleanUrl(", start);
    assert.ok(start >= 0 && end > start, "Expected Vite unload handler is present");
    const unload = result.code.slice(start, end);
    assert.doesNotThrow(() => runInNewContext(unload, {}), "Worker has no window object");
    let event = "";
    runInNewContext(unload, { window: { addEventListener: (name: string) => { event = name; } } });
    assert.equal(event, "beforeunload", "Browser unload handling remains active");
  } finally {
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test("Windows runtime paths are protected while application modules keep their transforms", () => {
  const calls: string[] = [];
  const framework = {
    name: "vinext:typeof-window-scan",
    transform: { handler: (_code: string, id: string) => { calls.push(id); return { code: "transformed" }; } },
  };
  workerSafeDevRuntime().configResolved({ plugins: [framework] });
  const hook = framework.transform.handler;
  const runtime = String.raw`C:\Users\gupta\project\node_modules\vite\dist\client\client.mjs`;
  assert.equal(hook("typeof window", runtime), null);
  assert.equal(hook("typeof window", "/@vite/client?v=1"), null);
  assert.deepEqual(hook("typeof window", "/project/components/dashboard.tsx"), { code: "transformed" });
  assert.deepEqual(calls, ["/project/components/dashboard.tsx"]);
});
