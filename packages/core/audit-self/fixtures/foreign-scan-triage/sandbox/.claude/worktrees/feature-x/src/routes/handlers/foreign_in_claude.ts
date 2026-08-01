// FOREIGN sentinel file — this comment + the filename `foreign_in_claude` are the markers
// repro.sh greps for in script output. If any suspect walker's output contains this
// filename, the over-walk is REPRODUCED.
//
// The body uses .safeParse() so detect-r2-boundary.sh's parse_site_files() picks it up.
import { z } from 'zod';

const ForeignSchema = z.object({ marker: z.string() });

export const foreign_in_claude = (raw: unknown) => ForeignSchema.safeParse(raw);
