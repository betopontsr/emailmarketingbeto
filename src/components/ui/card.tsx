import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...p }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-4 pb-2", className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-sm font-semibold leading-none", className)} {...p} />;
}
export function CardDescription({ className, ...p }: React.ComponentProps<"p">) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...p} />;
}
export function CardContent({ className, ...p }: React.ComponentProps<"div">) {
  return <div className={cn("p-4 pt-2", className)} {...p} />;
}
