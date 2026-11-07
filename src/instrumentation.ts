import type { Instrumentation } from "next";

/*
  Error monitoring that needs no extra account: every error on the server is written as one structured line to the
  host's log (Vercel → Project → Logs), with the page, the kind of request and the error code the visitor sees.
  No form data, cookies or personal details are logged. To also get alerts by email, connect a service such as Sentry
  later (see MANUAL_SETUP.md); nothing here has to change.
*/
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const e = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      at: new Date().toISOString(),
      digest: e.digest ?? null,
      message: String(e.message ?? error).slice(0, 300),
      path: request.path.split("?")[0],
      method: request.method,
      route: context.routePath,
      kind: context.routeType,
    }),
  );
};
