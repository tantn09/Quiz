"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Alert } from "./alert";

export function ErrorToast({ children }: { children: ReactNode }) {
  return createPortal(
    <Alert tone="error" className="pointer-events-none fixed right-4 top-4 z-[120] max-w-[calc(100vw-2rem)] shadow-lg">{children}</Alert>,
    document.body,
  );
}


const ErrorToastContext = createContext<(message: string) => void>(() => {});

export function ErrorToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<string[]>([]);
  const message = messages[0];
  const showError = useCallback((text: string) => {
    setMessages((current) => current.includes(text) ? current : [...current, text]);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessages((current) => current.slice(1)), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  return <ErrorToastContext.Provider value={showError}>
    {children}
    {message && <ErrorToast key={message}>{message}</ErrorToast>}
  </ErrorToastContext.Provider>;
}

export function useErrorToast() {
  return useContext(ErrorToastContext);
}
