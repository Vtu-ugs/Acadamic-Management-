// Keep only numerals, capped at maxDigits. Used for Aadhaar and any other
// plain fixed-length numeric field.
export const digitsOnly = (raw, maxDigits) => String(raw ?? '').replace(/\D/g, '').slice(0, maxDigits);

// An Indian mobile is 10 digits starting 6-9. People paste "+91 98765 43210"
// and "098765 43210"; stripping non-digits and taking the first 10 would turn
// the first into 9198765432 — a valid-looking but wrong number. Drop the
// country/trunk prefix instead.
export const normalizeMobile = (raw) => {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};
