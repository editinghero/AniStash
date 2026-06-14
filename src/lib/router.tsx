import React, { createContext, useContext, useEffect } from "react";

export type RouterContextType = {
  pathname: string;
  user: any;
  navigate: (to: string) => void;
  invalidate: () => void;
};

const RouterContext = createContext<RouterContextType | null>(null);

export const RouterProvider = RouterContext.Provider;

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return {
    state: {
      location: {
        pathname: ctx.pathname,
      },
    },
    navigate: ctx.navigate,
    invalidate: ctx.invalidate,
  };
}

export function useNavigate() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useNavigate must be used within RouterProvider");
  return (dest: string | { to: string }) => {
    const path = typeof dest === "string" ? dest : dest.to;
    ctx.navigate(path);
  };
}

export function useRouteContext(options?: { from: string }) {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouteContext must be used within RouterProvider");
  return { user: ctx.user };
}

export function Link({
  to,
  className,
  children,
  ...props
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}) {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("Link must be used within RouterProvider");

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    ctx.navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}

export function useDocumentMetadata(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", description);
    }
  }, [title, description]);
}
