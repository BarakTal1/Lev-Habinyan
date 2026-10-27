/** Shown at once while the next screen loads. It keeps the shell steady and the tap feels answered. */
export default function Loading() {
  return (
    <main aria-busy="true" className="px-5 pt-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[#E9E5DB]" />
      <div className="mt-6 flex flex-col gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[#EFEBE3]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-h-[72px] items-center gap-3 bg-white px-3.5">
            <div className="h-10 w-10 animate-pulse rounded-[10px] bg-[#EEEAE0]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-[#EEEAE0]" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-[#F2EFE7]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
