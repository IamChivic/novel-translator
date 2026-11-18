import { env } from "cloudflare:workers";
import {
  aiBaseUrl,
  createGatewayFetch,
  gatewayRefusal,
  refusalFromError,
} from "@every-app/sdk/server";

/** The provider the models in src/shared/options.ts are named for. */
const PROVIDER = "openrouter";

const NOT_SET_UP = new Set([
  "ai_provider_not_configured",
  "ai_default_not_configured",
  "integration_not_configured",
  "provider_not_allowed",
  "capability_not_requested",
]);

export class AiOffError extends Error {
  constructor(readonly setup: string | null) {
    super("Translation isn't set up yet.");
    this.name = "AiOffError";
  }
}

function gatewayFetch(): typeof fetch | null {
  return createGatewayFetch({ env, optional: true });
}

/**
 * Whether model calls would reach the provider. Asks the Gateway for a
 * route no model answers: an unconfigured provider is refused before the
 * route is, so this costs no model call.
 */
export async function aiStatus(): Promise<{ ready: boolean; setup: string | null }> {
  try {
    const call = gatewayFetch();
    if (!call) return { ready: false, setup: null };
    const response = await call(`${aiBaseUrl(PROVIDER)}/models`, { method: "GET" });
    const refusal = await gatewayRefusal(response);
    if (refusal && NOT_SET_UP.has(refusal.code)) {
      return { ready: false, setup: refusal.setup };
    }
    return { ready: true, setup: null };
  } catch (error) {
    const refusal = refusalFromError(error);
    if (refusal && NOT_SET_UP.has(refusal.code)) return { ready: false, setup: refusal.setup };
    return { ready: false, setup: null };
  }
}

/** One chat completion's text. Throws AiOffError when no provider is set up. */
export async function complete(
  model: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const call = gatewayFetch();
  if (!call) throw new AiOffError(null);
  let response: Response;
  try {
    response = await call(`${aiBaseUrl(PROVIDER)}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    });
  } catch (error) {
    const refusal = refusalFromError(error);
    if (refusal && NOT_SET_UP.has(refusal.code)) throw new AiOffError(refusal.setup);
    throw new Error("The model couldn't be reached. Try again.");
  }
  const refusal = await gatewayRefusal(response.clone());
  if (refusal) {
    if (NOT_SET_UP.has(refusal.code)) throw new AiOffError(refusal.setup);
    throw new Error(refusal.message || "The Gateway refused the model call.");
  }
  if (!response.ok) {
    throw new Error(`The model answered with an error (${response.status}). Try again.`);
  }
  const body = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown } }[];
  } | null;
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The model returned no translation. Try again.");
  }
  return content;
}
