/** Keep Vite's own browser/worker checks intact with vinext 1.0.0-beta.5. */
export function workerSafeDevRuntime() {
  return {
    name: "aashirwad:worker-safe-dev-runtime",
    apply: "serve",
    configResolved(config) {
      const plugin = config.plugins.find(p => p.name === "vinext:typeof-window-scan");
      const hook = plugin?.transform;
      if (!hook) return;
      const handler = typeof hook === "function" ? hook : hook.handler;

      // MapLibre's module worker imports /@vite/client for dynamic imports.
      // Folding that runtime's `typeof window` checks to "object" crashes it
      // inside a worker. Application modules retain vinext's normal transform.
      const guarded = function (code, id, ...args) {
        const file = id.replaceAll("\\", "/").split("?", 1)[0];
        if (file === "/@vite/client" || file === "/@vite/env" ||
            /\/vite\/dist\/client\/(?:client|env)\.m?js$/.test(file)) return null;
        return handler.call(this, code, id, ...args);
      };
      plugin.transform = typeof hook === "function"
        ? guarded
        : { ...hook, handler: guarded };
    },
  };
}
