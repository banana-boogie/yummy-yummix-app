import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PlanAlreadyExistsError } from "./plan-generator.ts";

Deno.test("PlanAlreadyExistsError carries the existing plan id", () => {
  const err = new PlanAlreadyExistsError("plan-abc");
  assertEquals(err.existingPlanId, "plan-abc");
  assertEquals(err.name, "PlanAlreadyExistsError");
  if (!(err instanceof PlanAlreadyExistsError)) {
    throw new Error("instanceof check failed");
  }
});

Deno.test("PlanAlreadyExistsError is an Error subclass", () => {
  const err = new PlanAlreadyExistsError("plan-xyz");
  if (!(err instanceof Error)) {
    throw new Error("should subclass Error");
  }
});
