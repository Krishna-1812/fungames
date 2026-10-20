import {existsSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
const targets=['public/_mockups']
// public/ is copied verbatim. New production assets must be reviewed here,
// rather than silently publishing every local HTML prototype or screenshot.
const allowed=new Set(['_headers','apple-touch-icon.png','badge-72.png','favicon-96.png','favicon.ico','icon-192.png','icon-512.png','manifest.webmanifest','sw.js'])
for(const entry of readdirSync('public'))if(!allowed.has(entry))throw new Error(`Unreviewed public asset: public/${entry}. Move development files outside public/ or explicitly add the production asset to the allowlist.`)
if(process.argv.includes('--built'))targets.push('dist/client/_mockups','.vercel/output/static/_mockups')
for(const target of targets)if(existsSync(resolve(target)))throw new Error(`${target} is a development prototype directory. Move it outside public/ before building or deploying.`)
console.log('PASS public asset allowlist and prototype output boundary.')
