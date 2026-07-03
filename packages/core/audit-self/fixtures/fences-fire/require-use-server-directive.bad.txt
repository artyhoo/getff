// BAD: async Server Action without 'use server' directive — R20 (restricted-syntax-audit-exempt) must flag this.
export async function action() {
  return { status: 'ok' };
}
