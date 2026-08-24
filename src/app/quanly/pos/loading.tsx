import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-3">
      <Card className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="hidden items-end gap-2 sm:flex">
            <Skeleton className="h-16 w-20" />
            <Skeleton className="h-16 w-20" />
          </div>
        </div>
      </Card>
      <div className="flex items-center gap-2">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_360px]">
        <Card className="flex flex-col p-0">
          <Skeleton className="h-12 w-full rounded-b-none" />
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-14 w-14" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-3">
          <Card className="space-y-3 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-full" />
          </Card>
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}