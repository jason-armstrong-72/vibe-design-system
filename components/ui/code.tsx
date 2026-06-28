import * as React from "react"
import { cn } from "@/lib/utils"

function Code({ className, ...props }: React.ComponentProps<"code">) {
  return <code data-slot="code" className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground", className)} {...props} />
}
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd data-slot="kbd" className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-2xs text-muted-foreground", className)} {...props} />
}
export { Code, Kbd }
