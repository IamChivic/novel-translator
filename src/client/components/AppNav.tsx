import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Library", exact: true },
  { to: "/translate", label: "Translate", exact: false },
  { to: "/defaults", label: "Defaults", exact: false },
] as const;

/** The member pages, for AppShell's bar. */
export function AppNav() {
  return (
    <nav className="flex min-w-0 items-center gap-3 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: link.exact }}
          className="text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
