const { asyncMap } = require('../src/task5/asyncArrayVariants');

(async ()=>{
  try {
    const res = await asyncMap([1,2,3], async v => v*3);
    console.log('smoke ok', res);
  } catch (err) {
    console.error('smoke fail', err);
    process.exit(1);
  }
})();
