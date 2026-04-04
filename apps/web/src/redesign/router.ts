export type AppRoute =
  | { kind: "landing" }
  | { kind: "get-started" }
  | { kind: "dashboard" }
  | { kind: "shortlist" }
  | { kind: "home"; homeId: string }
  | { kind: "workspace" };

export function parseRoute(pathname: string): AppRoute {
  if (pathname === "/get-started") {
    return { kind: "get-started" };
  }

  if (pathname === "/dashboard") {
    return { kind: "dashboard" };
  }

  if (pathname === "/shortlist" || pathname === "/prospects") {
    return { kind: "shortlist" };
  }

  if (pathname === "/workspace") {
    return { kind: "workspace" };
  }

  const homeMatch = pathname.match(/^\/home\/([^/]+)$/);
  if (homeMatch) {
    return { kind: "home", homeId: decodeURIComponent(homeMatch[1]) };
  }

  return { kind: "landing" };
}

export function hrefForRoute(route: AppRoute): string {
  switch (route.kind) {
    case "landing":
      return "/";
    case "get-started":
      return "/get-started";
    case "dashboard":
      return "/dashboard";
    case "shortlist":
      return "/shortlist";
    case "workspace":
      return "/workspace";
    case "home":
      return `/home/${encodeURIComponent(route.homeId)}`;
  }
}
