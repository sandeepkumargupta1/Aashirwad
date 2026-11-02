import test from "node:test";
import assert from "node:assert/strict";
import { handleAccountRequest, accountReply, farmStorageKey, restoreEntry, type FarmerProfile, type ProfileStore } from "../lib/account";

const origin = "https://aashirwad.test";
function repository() {
    const rows = new Map<string, FarmerProfile>();
    const store: ProfileStore = {
        async get(id) { return rows.get(id) ?? null; },
        async save(id, input) {
            const profile = { ...input, createdAt: rows.get(id)?.createdAt ?? "2026-11-01 00:00:00" };
            rows.set(id, profile); return profile;
        },
    };
    return { rows, store };
}
function post(body: unknown, from = origin) {
    return new Request(`${origin}/api/account`, { method: "POST", headers: { Origin: from, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
test("account writes require a signed-in identity and a same-origin request", async () => {
    const { store, rows } = repository();
    assert.equal((await handleAccountRequest(post({ displayName: "Farmer" }), null, store)).status, 401);
    assert.equal((await handleAccountRequest(post({ displayName: "Farmer" }, "https://elsewhere.test"), "alice", store)).status, 403);
    assert.equal(rows.size, 0);
});
test("a client cannot choose another account ID or read another farmer's profile", async () => {
    const { store, rows } = repository();
    assert.equal((await handleAccountRequest(post({ displayName: "Farmer", userId: "bob" }), "alice", store)).status, 400);
    const response = await handleAccountRequest(post({ displayName: "  Asha  ", village: " Sehore " }), "alice", store);
    assert.equal(response.status, 200);
    assert.equal(rows.get("alice")?.displayName, "Asha");
    assert.equal(rows.has("bob"), false);
    const other = await handleAccountRequest(new Request(`${origin}/api/account`), "bob", store);
    assert.equal(accountReply.parse(await other.json()).profile, null);
    assert.equal(other.headers.get("Cache-Control"), "private, no-store");
});
test("repeated account setup keeps the same record and validates names", async () => {
    const { store, rows } = repository();
    for (const displayName of ["", "x", "x".repeat(71)]) assert.equal((await handleAccountRequest(post({ displayName }), "alice", store)).status, 400);
    await handleAccountRequest(post({ displayName: "Asha" }), "alice", store);
    const original = rows.get("alice")?.createdAt;
    await handleAccountRequest(post({ displayName: "Asha Gupta", village: "Bhopal" }), "alice", store);
    assert.equal(rows.size, 1);
    assert.equal(rows.get("alice")?.createdAt, original);
    assert.equal(rows.get("alice")?.village, "Bhopal");
});
test("oversized input and unavailable account storage fail explicitly", async () => {
    const { store } = repository();
    assert.equal((await handleAccountRequest(post({ displayName: "x".repeat(3000) }), "alice", store)).status, 413);
    const failed: ProfileStore = { async get() { throw new Error("private database details"); }, async save() { throw new Error("private database details"); } };
    const response = await handleAccountRequest(new Request(`${origin}/api/account`), "alice", failed);
    assert.equal(response.status, 503);
    assert.ok(!JSON.stringify(await response.json()).includes("private database"));
});
test("demo and farmer accounts use isolated storage and unsigned account sessions cannot resume", () => {
    const key = "aashirwad-farm-v1";
    const scopes = [farmStorageKey(key, true, "alice"), farmStorageKey(key, false, "alice"), farmStorageKey(key, false, "bob"), key];
    assert.equal(new Set(scopes).size, 4);
    assert.equal(restoreEntry("account", false), null);
    assert.equal(restoreEntry("account", true), "account");
    assert.equal(restoreEntry("demo", false), "demo");
    assert.equal(restoreEntry("anything-else", true), null);
});
