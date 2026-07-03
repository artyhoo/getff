'use server';
// GOOD: 'use server' directive at top — R20 must NOT flag this.
export async function action() {
  return { status: 'ok' };
}
