// Explicit loopback fixture only. No fixture identity enters the normal app.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5088');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname));
assert.equal(base.protocol, 'http:');
assert.equal(base.username, '');
assert.equal(base.password, '');
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const { CourierApi, CourierError, statusAttempt, proofAttempt } =
    await server.ssrLoadModule('/app/features/courier/api.ts');
  const context = await (
    await fetch(new URL('/__test/booking-context', base))
  ).json();
  assert(context.roles.includes('Courier'));
  let loseResponse = true;
  const api = new CourierApi(async (path, init) => {
    const result = await fetch(new URL(String(path), base), init);
    if (loseResponse && init?.method === 'PUT' && result.ok) {
      loseResponse = false;
      await result.text();
      throw new TypeError('Simulated lost response after commit');
    }
    return result;
  });
  const manifest = await api.manifest();
  const selected = manifest.items.find((p) => p.status === 'Assigned');
  assert(selected, 'Start a fresh Courier workflow fixture.');
  let parcel = await api.detail(selected.id);
  const first = statusAttempt(parcel, 'PickedUp', 'TESTDATA collected');
  await assert.rejects(
    api.submit(first),
    (e) => e instanceof CourierError && e.uncertain,
  );
  assert.equal((await api.submit(first)).status, 'PickedUp');
  assert.equal((await api.submit(first)).version, '3');
  parcel = await api.detail(parcel.id);
  assert.equal(
    (
      await api.submit(
        statusAttempt(parcel, 'InTransit', 'TESTDATA in transit'),
      )
    ).status,
    'InTransit',
  );
  parcel = await api.detail(parcel.id);
  await assert.rejects(
    api.submit(
      statusAttempt(
        { ...parcel, version: '3' },
        'OutForDelivery',
        'TESTDATA stale',
      ),
    ),
    (e) => e.code === 'stale_version',
  );
  await api.submit(
    statusAttempt(parcel, 'OutForDelivery', 'TESTDATA out for delivery'),
  );
  parcel = await api.detail(parcel.id);
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAYAAAD+Bd/7AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAhSURBVBhXY2BIYfiPF2MIoGMMAXSMIYCOMQTQMYYAGgYAgZVCkckcricAAAAASUVORK5CYII=',
    'base64',
  );
  const proof = proofAttempt(
    parcel,
    'TESTDATA Recipient',
    new File([bytes], 'photo.png', { type: 'image/png' }),
  );
  assert.equal((await api.submit(proof)).status, 'Delivered');
  assert.equal((await api.submit(proof)).status, 'Delivered');
  await assert.rejects(api.detail(parcel.id), (e) => e.status === 404);
  const fail = (await api.manifest()).items.find(
    (p) => p.status === 'OutForDelivery',
  );
  assert(fail);
  await api.submit(
    statusAttempt(
      await api.detail(fail.id),
      'Failed',
      'TESTDATA unreachable',
      'AddressUnreachable',
    ),
  );
  const history = await api.history();
  assert(
    history.items.some((p) => p.id === parcel.id && p.status === 'Delivered'),
  );
  assert(history.items.some((p) => p.id === fail.id && p.status === 'Failed'));
  assert(history.items.every((p) => Object.keys(p).length === 6));
  console.log(
    'PASS React production adapter: real PostgreSQL manifest/details, stages, lost-response replay, stale rejection, photo completion/replay, Failed reason, terminal privacy/history. TESTDATA fixture storage only.',
  );
} finally {
  await server.close();
}
