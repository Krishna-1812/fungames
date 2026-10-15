/**
 * make-vapid-keys — a key pair for the daily reminders (src/lib/push.ts).
 *
 *   node scripts/make-vapid-keys.mjs
 *
 * Prints two lines. Put each in Vercel (Project → Settings → Environment
 * Variables, Production) under the name it starts with, then redeploy. The
 * private one is a secret: it goes nowhere else. For `npm run dev`, the same
 * two lines in a .env file at the root (git ignores it) turn reminders on locally.
 *
 * Make a pair once. A new pair later silently ends every reminder already
 * set up, because each browser signed up to the old public key.
 */
const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const b64u = (b) => Buffer.from(b).toString('base64url')
const pub = new Uint8Array(await crypto.subtle.exportKey('raw', k.publicKey))
const { d } = await crypto.subtle.exportKey('jwk', k.privateKey)
console.log(`VAPID_PUBLIC_KEY=${b64u(pub)}`)
console.log(`VAPID_PRIVATE_KEY=${d}`)
