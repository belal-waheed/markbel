import { cn } from "@/lib/utils"

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton rounded-md", className)}
      {...props}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-5 rounded-xl space-y-4">
      <Skeleton className="h-6 w-1/3 rounded-lg" />
      <Skeleton className="h-4 w-1/2 rounded-lg" />
      <div className="pt-4">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/20">
          <Skeleton className="w-5 h-5 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4 rounded-lg" />
            <Skeleton className="h-3 w-1/4 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}
