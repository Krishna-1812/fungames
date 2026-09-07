import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { CATALOGUE } = await import('../src/data/lots.ts')
const { LOT_ART, lotArt } = await import('../src/lib/auction-art.ts')
const { resultCardSvg } = await import('../src/lib/result-card.ts')
assert.deepEqual(Object.keys(LOT_ART).sort(), CATALOGUE.map(l => l.id).sort())
assert.equal(new Set(Object.values(LOT_ART)).size, CATALOGUE.length)
for (const lot of CATALOGUE) {
  assert.ok(lotArt(lot.id).includes('viewBox="0 0 320 220"'))
  assert.ok(!/<script|foreignObject|https?:/i.test(LOT_ART[lot.id]))
}
for (const headline of ['Kept every penny', 'Up £12,345', 'Down £12,000']) {
  assert.ok(resultCardSvg({slug:'auction',siteName:'',headline,sub:'At the end of fourteen lots',stats:[
    {label:'Bought',value:'14'}, {label:'Paid',value:'£12,000'}, {label:'Appraised',value:'£99,999'},
  ]}).includes('<svg'))
}
console.log('All fourteen lots have distinct self-contained art; Auction result variants render.')
