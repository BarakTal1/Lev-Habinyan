/** Shown at once while the next screen loads. It keeps the shell steady and the tap feels answered. */
export default function Loading() {
  return (
    <main aria-busy="true" className="mx-auto max-w-[1280px] px-4 pt-5 lg:px-8 lg:pt-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[#E4E8EF]" />
      <div className="mt-6 flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-[#E8ECF2]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-h-[72px] items-center gap-3 bg-white px-3.5">
            <div className="h-10 w-10 animate-pulse rounded-[10px] bg-[#E8ECF2]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-[#E8ECF2]" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-[#EEF1F5]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
