import { MyPlatformAccounts } from "@/app/mypage/platform-accounts/platform-accounts-client";

export default function AdminPlatformAccountsPage() {
  return <MyPlatformAccounts initialPlatform="panda" scope="admin" />;
}
