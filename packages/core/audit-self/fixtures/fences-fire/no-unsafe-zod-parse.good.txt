// GOOD: calls .safeParse() instead — R2 (no-unsafe-zod-parse) must NOT flag this.
const bodySchema = { safeParse: (x: unknown) => ({ success: true, data: x }) };
const result = bodySchema.safeParse(process.env.INPUT);
export { result };
