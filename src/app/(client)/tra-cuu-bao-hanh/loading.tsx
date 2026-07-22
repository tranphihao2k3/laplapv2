import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <Skeleton className="h-52 w-full rounded-none" />

      {/* Search box */}
      <div className="container mx-auto max-w-3xl px-4">
        <div className="relative z-10 -mt-14 rounded-2xl border bg-white p-5 shadow-xl space-y-3">
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1 rounded-md" />
            <Skeleton className="h-11 w-28 rounded-md" />
          </div>
          <Skeleton className="h-3 w-56" />
        </div>

        {/* Steps */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border p-5 space-y-3 text-center">
              <Skeleton className="mx-auto h-11 w-11 rounded-full" />
              <Skeleton className="mx-auto h-4 w-20" />
              <Skeleton className="mx-auto h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
