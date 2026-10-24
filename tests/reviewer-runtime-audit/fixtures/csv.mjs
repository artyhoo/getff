export function csv(rows) {
  return rows.map(row => row.map(value => {
    const s = String(value);
    return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
  }).join(',')).join('\r\n');
}
