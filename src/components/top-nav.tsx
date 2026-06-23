import Link from "next/link";
import { TokenSearch } from "@/components/token-search";
import { UserMenu } from "@/components/user-menu";

export function TopNav({ email }: { email: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-6 border-b bg-sidebar px-4">
      <Link href="/dashboard" className="shrink-0 font-semibold">
        ToknHost
      </Link>
      <div className="flex flex-1 justify-center">
        <TokenSearch />
      </div>
      <UserMenu email={email} />
    </header>
  );
}
