import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { messageOf } from "@/client/lib/errors";

/** Runs a change, then reloads the page's data; a failure is a toast. */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run(work: () => Promise<unknown>): Promise<boolean> {
    setPending(true);
    try {
      await work();
      await router.invalidate();
      return true;
    } catch (error) {
      toast.error(messageOf(error));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { run, pending };
}
