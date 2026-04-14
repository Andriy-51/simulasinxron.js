Task 7 (Reactive Communication)

Quick usage:

const { createReactiveChannel } = require('../src/task7/reactiveCommunication');
const ch = createReactiveChannel();
ch.on('event', v => console.log('got', v));
ch.emit('event', 42);

Observables:
const { createObservable } = require('../src/task7/reactiveCommunication');
const obs = createObservable(sink => { sink.next(1); sink.complete(); });
obs.subscribe(v => console.log('obs', v), err => console.error(err), () => console.log('done'));
