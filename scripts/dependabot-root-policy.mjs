const MANIFESTS = ['package.json', 'crashreporting/package.json', 'tooling/package.json'];
const DIRECT = new Map([['eslint', 'devDependencies'], ['@revenuecat/purchases-js', 'dependencies']]);
const REVIEWED = new Set([...DIRECT.keys(), '@radix-ui/react-collection', '@radix-ui/react-direction',
  '@radix-ui/react-presence', '@radix-ui/react-primitive', '@radix-ui/react-roving-focus',
  '@radix-ui/react-slot', '@radix-ui/react-tabs']);
const PACKAGE = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function text(value) {
  assert(typeof value === 'string' || Buffer.isBuffer(value), 'Dependency inputs must be complete file contents.');
  const result = Buffer.isBuffer(value) ? new TextDecoder('utf-8', { fatal: true }).decode(value) : value;
  assert(!result.includes('\0'), 'Dependency inputs contain an invalid null character.');
  return result;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function scalar(value) {
  assert(value.length > 0 && !/[\r\n\t]/.test(value), 'Unsupported Yarn scalar.');
  if (value.startsWith('"')) {
    const parsed = JSON.parse(value);
    assert(typeof parsed === 'string' && parsed.length > 0 && !/[\x00-\x1f]/.test(parsed), 'Unsupported quoted Yarn scalar.');
    return parsed;
  }
  assert(!/["#]/.test(value) && value.trim() === value, 'Unsupported unquoted Yarn scalar.');
  return value;
}

function selectors(header) {
  const values = [];
  let remaining = header;
  while (remaining) {
    const match = remaining.match(/^("(?:[^"\\]|\\.)*"|[^,\s"]+)(?:,\s*|$)/);
    assert(match, 'Unsupported Yarn selector list.');
    values.push(scalar(match[1]));
    remaining = remaining.slice(match[0].length);
    assert(match[0].length === match[1].length || remaining, 'Incomplete Yarn selector list.');
  }
  return values;
}

function packageName(selector) {
  const boundary = selector.indexOf('@', selector.startsWith('@') ? 1 : 0);
  const name = selector.slice(0, boundary);
  assert(boundary > 0 && PACKAGE.test(name) && selector.slice(boundary + 1).length > 0, 'Unsupported Yarn package selector.');
  return name;
}

export function parseYarnLockfile(value) {
  const source = text(value).replace(/\r\n/g, '\n');
  assert(source.split('\n').includes('# yarn lockfile v1'), 'Only Yarn v1 lockfiles are supported.');
  const entries = new Map();
  let current;
  let section;
  for (const line of source.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    assert(!/[\r\t]/.test(line), 'Unsupported Yarn indentation.');
    if (!line.startsWith(' ')) {
      assert(line.endsWith(':'), 'Unsupported Yarn entry header.');
      const keys = selectors(line.slice(0, -1));
      const names = new Set(keys.map(packageName));
      assert(keys.length > 0 && names.size === 1, 'A grouped Yarn entry must identify one package.');
      current = { name: [...names][0], fields: Object.create(null) };
      section = undefined;
      for (const key of keys) {
        assert(!entries.has(key), 'Duplicate Yarn selector.');
        entries.set(key, current);
      }
      continue;
    }
    assert(current, 'Yarn field without an entry.');
    const nested = line.match(/^    ("(?:[^"\\]|\\.)*"|[^\s"]+) (.+)$/);
    if (nested) {
      assert(section, 'Unexpected nested Yarn field.');
      const name = scalar(nested[1]);
      assert(PACKAGE.test(name) && !Object.hasOwn(current.fields[section], name), 'Invalid or duplicate Yarn dependency.');
      current.fields[section][name] = scalar(nested[2]);
      continue;
    }
    const field = line.match(/^  (version|resolved|integrity) (.+)$/);
    if (field) {
      assert(!Object.hasOwn(current.fields, field[1]), 'Duplicate Yarn field.');
      current.fields[field[1]] = scalar(field[2]);
      section = undefined;
      continue;
    }
    const group = line.match(/^  (dependencies|optionalDependencies):$/);
    assert(group && !Object.hasOwn(current.fields, group[1]), 'Unsupported or duplicate Yarn field.');
    section = group[1];
    current.fields[section] = Object.create(null);
  }
  assert(entries.size > 0, 'Yarn lockfile is empty.');
  for (const entry of new Set(entries.values())) {
    assert(['version', 'resolved', 'integrity'].every((key) => typeof entry.fields[key] === 'string'), 'Incomplete Yarn entry.');
  }
  return entries;
}

function version(value) {
  const match = typeof value === 'string' && value.match(VERSION);
  assert(match, 'Only exact stable registry versions are eligible.');
  const numbers = match.slice(1).map(Number);
  assert(numbers.every(Number.isSafeInteger), 'Dependency version exceeds supported bounds.');
  return numbers;
}

function compare(a, b) {
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}

function series(value) {
  const parts = version(value);
  return parts[0] === 0 ? `0.${parts[1]}` : String(parts[0]);
}

function manifestMap(values) {
  assert(values && canonical(Object.keys(values).sort()) === canonical([...MANIFESTS].sort()), 'Every root workspace manifest is required.');
  return Object.fromEntries(MANIFESTS.map((name) => {
    const parsed = JSON.parse(text(values[name]));
    assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'Invalid package manifest.');
    return [name, parsed];
  }));
}

function records(entries, name) {
  return [...new Map([...entries.values()].filter((entry) => entry.name === name)
    .map((entry) => [canonical(entry.fields), entry.fields])).values()];
}

function edges(values) {
  return new Set(values.flatMap((entry) => ['dependencies', 'optionalDependencies'].flatMap((field) =>
    Object.entries(entry[field] || {}).map(([name, range]) => JSON.stringify([field, name, range])))));
}

function reviewProtectedEdges(name, values) {
  const groups = new Map();
  for (const entry of values) {
    const key = series(entry.version);
    if (!groups.has(key)) groups.set(key, new Set());
    const protectedEdges = [...edges([entry])].filter((edge) => !REVIEWED.has(JSON.parse(edge)[1])).sort();
    groups.get(key).add(canonical(protectedEdges));
  }
  assert([...groups.values()].every((group) => group.size === 1), `Unreviewed dependency edge across versions of ${name}; protected relationships must be identical within each reviewed series.`);
}

function registryEntry(name, entry) {
  version(entry.version);
  const url = new URL(entry.resolved);
  const tarball = `${name}/-/${name.split('/').at(-1)}-${entry.version}.tgz`;
  assert(url.protocol === 'https:' && ['registry.yarnpkg.com', 'registry.npmjs.org'].includes(url.hostname) &&
    !url.username && !url.password && !url.port && !url.search &&
    decodeURIComponent(url.pathname) === `/${tarball}` && (!url.hash || /^#[a-f0-9]{40}$/.test(url.hash)),
  `Changed package ${name} must resolve to its exact npm registry tarball.`);
  const integrity = entry.integrity.match(/^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/);
  const expectedBytes = { sha256: 32, sha384: 48, sha512: 64 };
  assert(integrity && Buffer.from(integrity[2], 'base64').length === expectedBytes[integrity[1]] &&
    Buffer.from(integrity[2], 'base64').toString('base64') === integrity[2], `Changed package ${name} needs a valid strong integrity digest.`);
}

export function evaluateRootUpdate({ baseManifests, headManifests, baseLockfile, headLockfile } = {}) {
  try {
    const base = manifestMap(baseManifests);
    const head = manifestMap(headManifests);
    const updates = [];
    for (const [name, field] of DIRECT) {
      const before = base['package.json'][field]?.[name];
      const after = head['package.json'][field]?.[name];
      if (before === after) continue;
      const previous = version(before);
      const next = version(after);
      assert(series(before) === series(after) && compare(next, previous) > 0, `${name} requires a stable patch or minor upgrade within its reviewed series.`);
      updates.push({ name, from: before, to: after });
      head['package.json'][field][name] = before;
    }
    assert(updates.length > 0, 'No reviewed pure-JavaScript direct dependency upgrade was found.');
    assert(canonical(base) === canonical(head), 'Only reviewed root dependency version pins may change; all other manifest content must remain unchanged.');
    const previous = parseYarnLockfile(baseLockfile);
    const next = parseYarnLockfile(headLockfile);
    for (const update of updates) {
      assert(previous.get(`${update.name}@${update.from}`)?.fields.version === update.from &&
        next.get(`${update.name}@${update.to}`)?.fields.version === update.to, `Lockfile does not match the exact ${update.name} manifest pins.`);
    }
    const names = new Set([...previous.values(), ...next.values()].map((entry) => entry.name));
    const changedLockfilePackages = [];
    for (const name of names) {
      const before = records(previous, name);
      const after = records(next, name);
      const sameRecords = canonical(before.map(canonical).sort()) === canonical(after.map(canonical).sort());
      if (!REVIEWED.has(name)) {
        assert(sameRecords, `Unreviewed lockfile drift in ${name}; native and build-tool records must stay unchanged.`);
        for (const [selector, entry] of previous) if (entry.name === name && next.has(selector)) {
          assert(canonical(entry.fields) === canonical(next.get(selector).fields), `Unreviewed selector retargeting in ${name}.`);
        }
        continue;
      }
      reviewProtectedEdges(name, [...before, ...after]);
      for (const [selector, entry] of previous) if (entry.name === name && next.has(selector)) {
        const destination = next.get(selector).fields;
        assert(series(entry.fields.version) === series(destination.version) &&
          compare(version(destination.version), version(entry.fields.version)) >= 0, `Unreviewed selector downgrade or major retargeting in ${name}.`);
      }
      if (sameRecords) {
        for (const [selector, entry] of previous) if (entry.name === name && next.has(selector)) {
          assert(canonical(entry.fields) === canonical(next.get(selector).fields), `Unreviewed selector retargeting in ${name}.`);
        }
        continue;
      }
      assert(before.length > 0 && after.length > 0, `Adding or removing ${name} requires a dependency review.`);
      for (const entry of [...before, ...after]) registryEntry(name, entry);
      assert(canonical([...new Set(before.map((entry) => series(entry.version)))].sort()) ===
        canonical([...new Set(after.map((entry) => series(entry.version)))].sort()), `Unreviewed major or preview change in ${name}.`);
      for (const entry of after) {
        const identicalVersion = before.filter((old) => old.version === entry.version);
        assert(identicalVersion.length === 0 || identicalVersion.some((old) => canonical(old) === canonical(entry)), `Same-version source or dependency mutation in ${name}.`);
        const floor = before.filter((old) => series(old.version) === series(entry.version))
          .map((old) => version(old.version)).sort(compare).at(-1);
        assert(identicalVersion.length > 0 || compare(version(entry.version), floor) >= 0, `Unreviewed downgrade in ${name}.`);
      }
      const oldEdges = edges(before);
      const newEdges = edges(after);
      for (const edge of new Set([...oldEdges, ...newEdges])) if (oldEdges.has(edge) !== newEdges.has(edge)) {
        const [, target, range] = JSON.parse(edge);
        assert(REVIEWED.has(target) && /^[0-9xX*^~<>=|. +\-]+$/.test(range), `Unreviewed dependency edge from ${name} to ${target}.`);
      }
      changedLockfilePackages.push(name);
    }
    return { allowed: true, reason: 'Reviewed pure-JavaScript updates with unchanged native and build-tool records.', updates, changedLockfilePackages: changedLockfilePackages.sort() };
  } catch (error) {
    return { allowed: false, reason: error.message, updates: [], changedLockfilePackages: [] };
  }
}
