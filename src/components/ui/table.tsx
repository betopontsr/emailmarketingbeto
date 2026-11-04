import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...p }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border">
      <table className={cn("w-full caption-bottom text-sm", className)} {...p} />
    </div>
  );
}
export function THead(p: React.ComponentProps<"thead">) {
  return <thead className="bg-muted/50 text-xs text-muted-foreground" {...p} />;
}
export function TBody(p: React.ComponentProps<"tbody">) {
  return <tbody className="[&_tr:last-child]:border-0" {...p} />;
}
export function TR({ className, ...p }: React.ComponentProps<"tr">) {
  return <tr className={cn("border-b hover:bg-muted/30", className)} {...p} />;
}
export function TH({ className, ...p }: React.ComponentProps<"th">) {
  return <th className={cn("h-9 px-3 text-left font-medium whitespace-nowrap", className)} {...p} />;
}
export function TD({ className, ...p }: React.ComponentProps<"td">) {
  return <td className={cn("px-3 py-2 align-top", className)} {...p} />;
}
