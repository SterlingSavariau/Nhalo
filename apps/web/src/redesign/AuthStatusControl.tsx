import type { AuthenticatedUser } from "@nhalo/types";
import { ChevronDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface AuthStatusControlProps {
  user: AuthenticatedUser | null;
  onSignIn(): void;
  onSignOut(): void;
}

function getUserLabel(user: AuthenticatedUser): string {
  return user.name?.trim() || user.givenName?.trim() || user.email;
}

function getUserInitials(user: AuthenticatedUser): string {
  const source = user.name?.trim() || `${user.givenName ?? ""} ${user.familyName ?? ""}`.trim();
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || user.email.slice(0, 1).toUpperCase();
}

export function AuthStatusControl({
  user,
  onSignIn,
  onSignOut
}: AuthStatusControlProps) {
  if (!user) {
    return (
      <Button
        className="rounded-none"
        onClick={onSignIn}
        size="sm"
        type="button"
        variant="outline"
      >
        Sign in
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="h-9 rounded-none border-border px-2.5 sm:pr-3"
          size="sm"
          type="button"
          variant="outline"
        >
          <Avatar className="size-6" size="sm">
            {user.pictureUrl ? <AvatarImage alt={getUserLabel(user)} src={user.pictureUrl} /> : null}
            <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm sm:inline">{getUserLabel(user)}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-none" sideOffset={8}>
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate font-medium text-foreground">{getUserLabel(user)}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} variant="destructive">
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
