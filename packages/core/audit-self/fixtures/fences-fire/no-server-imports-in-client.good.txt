'use client';
// GOOD: 'use client' file only imports client-safe modules — R12 must NOT flag this.
import { useState } from 'react';
export function Component() {
  const [count, setCount] = useState(0);
  return count;
}
