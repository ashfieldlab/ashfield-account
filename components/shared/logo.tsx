import Image from "next/image"

import { cn } from "@/lib/utils"

/** Ashfield 마크 + "계정" 워드마크. */
export function Logo({ className, size = 28, withText = true }: { className?: string; size?: number; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image src="/icons/ashfield/mark.svg" alt="Ashfield" width={size} height={size} unoptimized className="shrink-0" />
      {withText && (
        <span className="text-[15px] font-semibold tracking-tight">
          Ashfield <span className="font-normal text-muted-foreground">계정</span>
        </span>
      )}
    </span>
  )
}
