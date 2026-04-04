import { cn } from "@/lib/utils";

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
  imageClassName?: string;
  labelClassName?: string;
}

export function BrandMark({
  compact = false,
  className,
  imageClassName,
  labelClassName
}: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <img
        alt="Nhalo logo"
        className={cn("h-10 w-10 object-contain", compact ? "h-8 w-8" : "", imageClassName)}
        src="/nhalo-logo.png"
      />
      <span
        className={cn(
          "font-serif text-xl tracking-tight text-foreground",
          compact ? "text-lg" : "",
          labelClassName
        )}
      >
        Nhalo
      </span>
    </span>
  );
}
