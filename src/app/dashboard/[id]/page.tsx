import { redirect } from "next/navigation";

// Bare /dashboard/[id] has no content of its own — the sidebar always links
// directly to a section (default: details), but this redirect covers any
// stale bookmarks/links to the old single-page-with-tabs URL.
export default async function DesignSystemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/${id}/details`);
}
