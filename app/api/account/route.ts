import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { farmerProfiles } from "../../../db/schema";
import { handleAccountRequest, type ProfileStore } from "../../../lib/account";

export const dynamic = "force-dynamic";
const fields = { displayName: farmerProfiles.displayName, village: farmerProfiles.village, createdAt: farmerProfiles.createdAt };
const store: ProfileStore = {
    async get(userId) {
        return (await getDb().select(fields).from(farmerProfiles).where(eq(farmerProfiles.userId, userId)).get()) ?? null;
    },
    async save(userId, input) {
        const db = getDb();
        await db.insert(farmerProfiles).values({ userId, ...input }).onConflictDoUpdate({ target: farmerProfiles.userId, set: input }).run();
        const profile = await db.select(fields).from(farmerProfiles).where(eq(farmerProfiles.userId, userId)).get();
        if (!profile) throw new Error("Account profile was not saved.");
        return profile;
    },
};
async function account(request: Request) {
    const user = await getChatGPTUser();
    return handleAccountRequest(request, user?.userId ?? null, store);
}
export const GET = account;
export const POST = account;
