import {
  createRootRoute,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import {
  themePreferenceInitScript,
  useThemePreference,
} from "@/client/lib/theme";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import appCss from "@/client/styles/app.css?url";
import { getGatewayUrl } from "@/serverFunctions/gateway";

export const Route = createRootRoute({
  // Where the Gateway is: the way back to it (AppShell), and the theme pick
  // the app shares with the launcher and every other app.
  // A visitor on a share page has no session: no way back, nothing to share.
  loader: () => getGatewayUrl().catch(() => ({ gatewayUrl: null })),
  staleTime: Infinity,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { title: "Novel Translator" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
});

function NotFound() {
  return (
    <AppShell>
      <div data-testid="not-found">
        <EmptyState kind="filtered" title="Not found" description="It may have been deleted, or it isn't yours." />
      </div>
    </AppShell>
  );
}

function ErrorPage({ error }: ErrorComponentProps) {
  return (
    <AppShell>
      <PageHeader title="Something went wrong" />
      <Alert variant="destructive">
        <AlertDescription>{error instanceof Error && error.message ? error.message : "Try again."}</AlertDescription>
      </Alert>
    </AppShell>
  );
}

/** Toasts ("Copied") in the app's theme. */
function ThemedToaster() {
  const { themePreference } = useThemePreference();
  return <Toaster theme={themePreference} position="bottom-right" />;
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme before the first paint: dark never flashes light. */}
        <script
          dangerouslySetInnerHTML={{ __html: themePreferenceInitScript }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <ThemedToaster />
        <Scripts />
      </body>
    </html>
  );
}
