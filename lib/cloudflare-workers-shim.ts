// Stand-in for the `cloudflare:workers` runtime module, used only by
// standard Next.js builds (for example on Vercel). The real module exists
// only in the Cloudflare Workers runtime, so this shim lets the build
// succeed outside Workers. It deliberately provides no bindings: code that
// needs a real binding (see db/index.ts) already reports it as unavailable
// when the binding is missing, so account features stay disabled instead
// of breaking the whole build. The Workers build never reads this file;
// it resolves `cloudflare:workers` from the runtime itself.
export const env: Record<string, unknown> = {};
