"use client";

import { useEffect, useState } from "react";
import { createTheme, MantineProvider } from "@mantine/core";

const theme = createTheme({
  fontFamily: "var(--font-be-vietnam-pro), Arial, sans-serif",
  primaryColor: "violet",
  defaultRadius: "md",
});

export function AppMantineProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const sync = () => setScheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return <MantineProvider theme={theme} forceColorScheme={scheme}>{children}</MantineProvider>;
}
