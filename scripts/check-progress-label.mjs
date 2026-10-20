import assert from 'node:assert/strict'
import {register} from 'node:module'
register('./resolve-ts.mjs',import.meta.url)
const {progressSummary,progressText}=await import('../src/lib/progress-label.ts')
assert.equal(progressSummary('spend-it',6,'$100B left'),'Spent $6')
assert.equal(progressSummary('deep-time',1200,'4.45 bn yrs'),'12% explored')
assert.equal(progressSummary('deep-time',1,'4.54 bn yrs'),'0.01% explored')
assert.equal(progressSummary('deep-time',10000,'0 yrs'),'100% explored')
assert.equal(progressSummary('orbit',420,'420 points'),'Best 420 points')
assert.equal(progressText('spend-it',1_000_001,'old label'),'Spent $1,000,001')
assert.equal(progressText('spend-it',NaN,'invalid'),'invalid')
console.log('PASS semantic progress, exact small purchases, exploration bounds and legacy labels.')
