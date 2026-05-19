import { z } from "zod";

// --- Installation ---

export const installationPatchSchema = z.object({
  notes: z.string().max(2000).optional(),
  comParc: z.string().max(500).optional(),
  status: z.enum(["EN_PARC", "HORS_PARC", "RENOUVELE"]).optional(),
  alwaysInFleet: z.boolean().optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  durationMonths: z.coerce.number().int().min(1).max(600).optional(),
  family: z.string().max(200).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  quantity: z.coerce.number().min(0).max(999999).optional(),
});

export const installationCreateSchema = z.object({
  invoiceLineId: z.string().min(1, "invoiceLineId requis"),
  durationMonths: z.coerce.number().int().min(1).max(600).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
});

// --- Client ---

export const clientPatchSchema = z.object({
  logoUrl: z.string().url().max(2000).or(z.literal("")).optional().nullable(),
  name: z.string().min(1).max(300).optional(),
  email: z.string().email().max(300).or(z.literal("")).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(200).optional().nullable(),
  zipCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
});

// --- Notifications ---

export const notificationActionSchema = z.object({
  action: z.enum(["test", "send", "test-email", "debug-cron"]),
  smtp: z.object({
    host: z.string().min(1),
    port: z.string().or(z.number()),
    secure: z.union([z.boolean(), z.string()]),
    user: z.string().min(1),
    pass: z.string().min(1),
    from: z.string().optional(),
  }).optional(),
});

// --- Bulk operations ---

export const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  action: z.enum(["delete", "status", "alwaysInFleet"]),
  value: z.union([z.string(), z.boolean()]).optional(),
});
