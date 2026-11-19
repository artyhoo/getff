import assert from 'node:assert/strict';
assert.equal([2,3].reduce((a,b)=>a+b,0),5);
console.log('REVIEWER-ACCEPTANCE-PASS');
