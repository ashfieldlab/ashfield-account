import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="불러오는 중">
      <Skeleton className="h-4 w-24" />
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-40" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-4 rounded-2xl border bg-card p-6">
          <Skeleton className="h-5 w-24" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
