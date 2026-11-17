// The build renames each `.name` of an internal name (scripts/private-names.mjs), so it must stop when an export of a
// module has that name: a call `module.name()` would be renamed to a function that does not exist (#475).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {privateNames} from '../../scripts/private-names.mjs';

const fixtures = path.join(import.meta.dirname, 'fixtures/private-names-export');

test('private-names: an internal name that is also an export stops the build and names both', () => {
    assert.throws(() => privateNames(fixtures, ['setLocationAt']), /internal member "setLocationAt" has the name of the export "setLocationAt" of src\/b\.ts/);
});

test('private-names: the names of src/ pass the check', () => {
    assert.ok(privateNames().size > 0);
});
