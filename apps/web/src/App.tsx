import { useEffect, useState } from "react";
import RedesignedApp from "./RedesignedApp";
import WorkspaceApp from "./WorkspaceApp";
import { parseRoute } from "./redesign/router";

export default function App() {
  const [route, setRoute] = useState(() =>
    typeof window === "undefined" ? parseRoute("/") : parseRoute(window.location.pathname)
  );

  useEffect(() => {
    function syncRoute() {
      setRoute(parseRoute(window.location.pathname));
    }

    window.addEventListener("popstate", syncRoute);
    window.addEventListener("codex:navigate", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("codex:navigate", syncRoute);
    };
  }, []);

  if (route.kind === "workspace") {
    return <WorkspaceApp />;
  }

  return <RedesignedApp />;
}
