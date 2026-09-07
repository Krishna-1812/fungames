/** Portraits are decorative; names and bidding states remain ordinary text. */
export const BIDDER_PORTRAITS: Record<string, string> = {
  holloway: '<path d="M14 78 Q15 53 40 53 Q65 53 66 78" fill="#596f63"/><ellipse cx="40" cy="32" rx="21" ry="26" fill="#c8c2b4"/><ellipse cx="40" cy="37" rx="16" ry="21" fill="#e3b58f"/><path d="M22 29 Q39 2 58 28" fill="#c8c2b4"/><g fill="none" stroke="#4d4a44" stroke-width="2"><circle cx="32" cy="36" r="7"/><circle cx="48" cy="36" r="7"/><path d="M39 36 H41 M25 40 Q14 65 32 68 M55 40 Q66 65 48 68"/></g>',
  vance: '<path d="M10 80 Q15 52 40 52 Q65 52 70 80" fill="#445065"/><path d="M31 54 L40 69 L49 54" fill="#eee2c9"/><ellipse cx="40" cy="34" rx="17" ry="23" fill="#ca956e"/><path d="M23 28 Q16 6 43 8 Q63 9 57 29 L45 18Z" fill="#302c2e"/><rect x="56" y="29" width="9" height="26" rx="3" fill="#b5a17f"/><path d="M62 49 L67 66" stroke="#ca956e" stroke-width="8"/>',
  okonkwo: '<path d="M12 80 Q18 53 40 53 Q63 53 68 80" fill="#837456"/><ellipse cx="40" cy="34" rx="19" ry="24" fill="#936345"/><path d="M21 25 Q20 5 40 6 Q61 7 59 27 L51 18 L27 20Z" fill="#302b27"/><path d="M31 53 L40 65 L49 53" fill="#e5d7bd"/><path d="M26 35 H35 M45 35 H54 M35 35 H45" stroke="#dbcba7" stroke-width="3"/>',
  petrov: '<path d="M10 80 Q15 50 40 51 Q65 50 70 80" fill="#723f50"/><ellipse cx="40" cy="35" rx="17" ry="23" fill="#e4bc9a"/><path d="M19 40 Q10 10 33 8 Q66 1 62 45 L52 27 L31 20 L25 44Z" fill="#52423b"/><path d="M23 63 Q40 75 57 63" fill="none" stroke="#dcb972" stroke-width="4"/>',
  quill: '<path d="M10 80 Q17 53 40 53 Q64 53 70 80" fill="#69714b"/><ellipse cx="40" cy="35" rx="18" ry="23" fill="#d5a77e"/><path d="M20 29 L17 16 L28 18 L28 7 L40 13 L54 7 L53 18 L64 23 L57 31 L47 22 L31 23Z" fill="#805337"/><path d="M31 58 L39 69 L49 58" fill="#ddc797"/><rect x="49" y="60" width="20" height="19" rx="2" fill="#8d5345"/>',
}

export function bidderPortrait(id: string) {
  return `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="40" cy="40" r="39" fill="#e2cda522"/>${BIDDER_PORTRAITS[id] ?? ''}<g fill="#372d28"><circle cx="32" cy="36" r="1.5"/><circle cx="48" cy="36" r="1.5"/></g><path d="M35 47 Q40 50 45 47" fill="none" stroke="#76503f" stroke-width="1.5"/></svg>`
}
