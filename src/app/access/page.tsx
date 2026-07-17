interface AccessPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--background)] px-5">
      <section className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-white p-7 shadow-[0_18px_60px_rgba(30,43,47,0.08)]">
        <div className="mb-7">
          <div className="mb-3 inline-flex rounded-full bg-[var(--brand-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
            Private Text Beta
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">进入 EOE Chat</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            这是密码保护的个人测试版本。请输入部署时设置的访问密码。
          </p>
        </div>

        <form action="/api/access" method="post" className="space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="block">
            <span className="mb-2 block text-sm font-medium">访问密码</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              className="w-full rounded-2xl border border-[var(--line-strong)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--brand-soft)]"
            />
          </label>
          {params.error ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              密码不正确，请重试。
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-2xl bg-[var(--brand)] px-4 py-3 font-medium text-white transition hover:opacity-90"
          >
            继续
          </button>
        </form>
      </section>
    </main>
  );
}
