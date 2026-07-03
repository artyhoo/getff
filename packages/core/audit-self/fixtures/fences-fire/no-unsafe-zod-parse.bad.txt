// BAD: calls .parse() on a Zod schema — R2 (no-unsafe-zod-parse) must flag this.
const bodySchema = { parse: (x: unknown) => x };
const result = bodySchema.parse(process.env.INPUT);
export { result };
