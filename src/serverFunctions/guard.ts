import { notFound } from "@tanstack/react-router";
import { NotFoundError } from "@/server/threads";

/** A missing or someone else's record becomes the router's not-found. */
export async function orNotFound<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof NotFoundError) throw notFound();
    throw error;
  }
}
