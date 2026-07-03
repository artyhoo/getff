'use client';
// BAD: 'use client' file imports a server-only module — R12 must flag this.
import fs from 'fs';
export const readConfig = () => fs.readFileSync('/etc/config', 'utf8');
