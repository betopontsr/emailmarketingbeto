import { TEST_UNSUBSCRIBE_TOKEN, verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

// Página pública, em inglês (é para o cliente).
export default async function UnsubscribePage(props: PageProps<"/u/[token]">) {
  const { token } = await props.params;
  const { done } = await props.searchParams;
  const valid = verifyUnsubscribeToken(token) !== null;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border p-6 text-center">
        {token === TEST_UNSUBSCRIBE_TOKEN ? (
          <p className="text-sm">This is a test email. There is nothing to unsubscribe.</p>
        ) : !valid ? (
          <p className="text-sm">This link is not valid. If you want to stop receiving emails, just reply to any email and ask us.</p>
        ) : done ? (
          <>
            <h1 className="text-lg font-semibold">You’re unsubscribed</h1>
            <p className="text-sm text-muted-foreground">You won’t receive any more of these emails.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Unsubscribe</h1>
            <p className="text-sm text-muted-foreground">Click the button below to stop receiving these emails.</p>
            <form method="post" action={`/api/unsubscribe/${token}`}>
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Unsubscribe me</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
