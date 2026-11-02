import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const farmerProfiles = sqliteTable("farmer_profiles", {
    userId: text("user_id").primaryKey(),
    displayName: text("display_name").notNull(),
    village: text("village").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
