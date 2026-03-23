import { DEFAULT_PROPERTY_TYPES, DEFAULT_RADIUS_MILES, DEFAULT_WEIGHTS, weightsAreValid } from "@nhalo/config";
import { z } from "zod";

const budgetSchema = z
  .object({
    min: z.number().positive().optional(),
    max: z.number().positive().optional()
  })
  .optional()
  .superRefine((budget, ctx) => {
    if (budget?.min && budget?.max && budget.min > budget.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "budget.min must be less than or equal to budget.max",
        path: ["min"]
      });
    }
  });

export const searchRequestSchema = z.object({
  locationType: z.enum(["city", "zip"]),
  locationValue: z.string().trim().min(1, "locationValue is required"),
  radiusMiles: z.number().positive().max(50).default(DEFAULT_RADIUS_MILES),
  budget: budgetSchema,
  minSqft: z.number().int().positive().optional(),
  minBedrooms: z.number().int().positive().optional(),
  propertyTypes: z
    .array(z.enum(["single_family", "condo", "townhome", "multi_family"]))
    .min(1)
    .optional()
    .default(DEFAULT_PROPERTY_TYPES),
  preferences: z.array(z.string().trim().min(1)).optional().default([]),
  weights: z
    .object({
      price: z.number().nonnegative(),
      size: z.number().nonnegative(),
      safety: z.number().nonnegative()
    })
    .optional()
    .default(DEFAULT_WEIGHTS)
}).superRefine((payload, ctx) => {
  if (!weightsAreValid(payload.weights)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "weights must be non-negative and sum to 100",
      path: ["weights"]
    });
  }
});

export type SearchRequestInput = z.infer<typeof searchRequestSchema>;
