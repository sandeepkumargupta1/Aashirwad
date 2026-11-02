import { z } from "zod";

export const profileInput = z.object({
    displayName: z.string().trim().min(2).max(70),
    village: z.string().trim().max(100).default(""),
}).strict();
export type ProfileInput = z.infer<typeof profileInput>;
export type FarmerProfile = ProfileInput & { createdAt: string };
export const accountReply = z.object({
    profile: profileInput.extend({ createdAt: z.string() }).nullable().optional(),
    error: z.string().optional(),
});
export type ProfileStore = {
    get(userId: string): Promise<FarmerProfile | null>;
    save(userId: string, input: ProfileInput): Promise<FarmerProfile>;
};

/** The identity comes only from Sites; the client never selects an account ID. */
export async function handleAccountRequest(request: Request, userId: string | null, store: ProfileStore) {
    const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
    const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
    if (!userId) return reply({ error: "Sign in with ChatGPT to continue." }, 401);
    if (!["GET", "POST"].includes(request.method)) return reply({ error: "Method not allowed." }, 405);
    try {
        if (request.method === "GET") return reply({ profile: await store.get(userId) });
        if (request.headers.get("Origin") !== new URL(request.url).origin || request.headers.get("Sec-Fetch-Site") === "cross-site") {
            return reply({ error: "Please submit the form from Aashirwad." }, 403);
        }
        if (!request.headers.get("Content-Type")?.startsWith("application/json")) return reply({ error: "Please submit valid account details." }, 400);
        if (Number(request.headers.get("Content-Length") || 0) > 2048) return reply({ error: "Account details are too long." }, 413);
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 2048) return reply({ error: "Account details are too long." }, 413);
        let body: unknown;
        try { body = JSON.parse(raw); } catch { return reply({ error: "Please submit valid account details." }, 400); }
        const parsed = profileInput.safeParse(body);
        if (!parsed.success) return reply({ error: "Enter a name of 2–70 characters and a village of up to 100 characters." }, 400);
        return reply({ profile: await store.save(userId, parsed.data) });
    } catch {
        return reply({ error: "Account service is unavailable. Please try again." }, 503);
    }
}

export const ENTRY_KEY = "aashirwad-entry-v2";
export type EntryKind = "demo" | "account";
export function restoreEntry(raw: string | null, signedIn: boolean): EntryKind | null {
    if (raw === "demo") return "demo";
    if (raw === "account" && signedIn) return "account";
    return null;
}
export function farmStorageKey(key: string, demo: boolean, accountKey?: string) {
    return demo ? key.replace(/^aashirwad-/, "aashirwad-demo-") : accountKey ? key.replace(/^aashirwad-/, `aashirwad-account-${accountKey}-`) : key;
}
