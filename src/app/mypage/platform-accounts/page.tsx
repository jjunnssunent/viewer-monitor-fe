import { MyPlatformAccounts } from "./platform-accounts-client";

type Platform = "panda" | "soop" | "youtube";

export default async function MyPlatformAccountsPage({ searchParams }: { searchParams: Promise<{ platform?: string }> }) {
  const { platform } = await searchParams;
  const initialPlatform: Platform = platform === "soop" || platform === "youtube" ? platform : "panda";
  return <MyPlatformAccounts initialPlatform={initialPlatform} />;
}
