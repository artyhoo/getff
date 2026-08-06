// Legitimate consumer boundary file — must be scanned by every audit-self walker.
import { z } from 'zod';

const PingSchema = z.object({ echo: z.string() });

export const ping = (raw: unknown) => PingSchema.safeParse(raw);
