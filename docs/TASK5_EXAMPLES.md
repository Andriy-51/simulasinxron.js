Task 5 (Async Array Variants)

Examples:

Callback version:

const { asyncMapCallback } = require('../src/task5/asyncArrayVariants');
asyncMapCallback([1,2,3], (v)=>v*2, (err, res) => { if (err) console.error(err); else console.log(res); });

Promise version (asyncMap):

const { asyncMap } = require('../src/task5/asyncArrayVariants');
(async ()=>{ console.log(await asyncMap([1,2,3], async v=>v*2)); })();
