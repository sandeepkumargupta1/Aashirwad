import AppEntry from "../../components/app-entry";
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "../chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Page() {
    const user = await getChatGPTUser();
    return <AppEntry signedIn={!!user} userKey={user?.userId} initialName={user?.fullName ?? ""} signInPath={chatGPTSignInPath("/login?mode=login")} createSignInPath={chatGPTSignInPath("/login?mode=create")} signOutPath={chatGPTSignOutPath("/login")} welcomeOnly/>;
}
