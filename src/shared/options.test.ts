import { expect, it } from "vitest";
import manifest from "../../everyapp.config";
import { MODEL_IDS } from "./options";

it("lets the Gateway accept every model a person can pick", () => {
  expect(manifest.ai?.models).toEqual(MODEL_IDS);
});
