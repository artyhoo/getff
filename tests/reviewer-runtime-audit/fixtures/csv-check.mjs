import assert from 'node:assert/strict';
import { csv } from './csv.mjs';
assert.equal(csv([['name', 'note'], ['Ada', 'a,b'], ['Grace', 'a"b'], ['Linus', 'a\nb']]), 'name,note\r\nAda,"a,b"\r\nGrace,"a""b"\r\nLinus,"a\nb"');
assert.equal(csv([]), '');
console.log('CSV-ACCEPTANCE-PASS');
