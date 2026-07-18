export function normalizePhone(input: string): string {
  let cleaned = input.replace(/[\s\-\(\)]/g, '');

  if (/^\+?91\d{10}$/.test(cleaned)) {
    cleaned = cleaned.replace(/^\+?91/, '+91');
    if (!cleaned.startsWith('+')) cleaned = '+91' + (cleaned.startsWith('91') ? cleaned.slice(2) : cleaned);
  } else if (/^\+?0?(\d{10})$/.test(cleaned)) {
    const m = cleaned.match(/\+?0?(\d{10})$/);
    if (m) cleaned = '+91' + m[1];
  } else if (/^\+\d{11,14}$/.test(cleaned)) {
    return cleaned;
  } else {
    throw new Error(`Invalid phone number: ${input}`);
  }

  if (!/^\+[1-9]\d{9,14}$/.test(cleaned)) {
    throw new Error(`Invalid phone number after normalization: ${input}`);
  }

  return cleaned;
}
