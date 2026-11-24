import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, join, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {createGunzip, gzipSync} from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const expected = new Map([
  ['BIOL 1406', [20000, 12500]], ['BIOL 1407', [20000, 12500]],
  ['CHEM 1405', [10000, 6250]], ['CHEM 1406', [10000, 6250]],
  ['CHEM 1411', [20000, 12500]], ['RESOURCES', [20000, 0]]
]);
const practiceSearchTerms = {
  'gas-compare': 'gas law gas laws ideal gas Boyle Charles pressure volume temperature',
  'hess-path': 'Hess law Hess laws enthalpy thermochemistry',
  'heat-and-state': 'specific heat heat capacity calorimetry phase change',
  'solution-mass': 'molarity concentration solute mass',
  'mass-to-particles': 'dimensional analysis mole moles Avogadro molar mass'
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function buildBridgeAssistLibrary(publish, input = here) {
  const descriptor = JSON.parse(await readFile(join(input, 'bridgeassist-inputs.json'), 'utf8'));
  const overlays = JSON.parse(await readFile(join(input, 'bridgeassist-site-overrides.json'), 'utf8'));
  assert.equal(descriptor.files.length, expected.size);
  assert.equal(new Set(descriptor.files.map(entry => entry.collection)).size, expected.size);
  const {libraryVersion, libraryTokens, normalizeQuestion, exactQuestion, bucketFor} = await import(
    'data:text/javascript;base64,' + Buffer.from(overlays.files.find(file => file.path === 'js/full-library.mjs').content).toString('base64')
  );
  for (const file of overlays.files) {
    assert(/^(?:js\/[a-z-]+\.(?:js|mjs|css)|data\/bridgeassist-library\/[a-zA-Z0-9.-]+\.json|assistant\.html|study\/bridgeassist-library\/index\.html)$/.test(file.path));
    assert.equal(digest(file.content), file.sha256, file.path);
    await mkdir(dirname(join(publish, file.path)), {recursive: true});
    await writeFile(join(publish, file.path), file.content);
  }
  assert.equal(descriptor.sources.file, 'bridgeassist-full-sources.json');
  const sourcesBytes = await readFile(join(input, descriptor.sources.file));
  assert.equal(digest(sourcesBytes), descriptor.sources.sha256);
  const sources = JSON.parse(sourcesBytes);
  assert.equal(Object.keys(sources).length, 443);

  assert(/^v\d+$/.test(libraryVersion));
  const destination = join(publish, 'data/bridgeassist-full', libraryVersion);
  const shardSize = 128;
  const pageSize = 20;
  const recordIds = new Set();
  const canonicalQuestions = new Set();
  const collections = [];
  const kindLists = {question: [], practice: []};
  const exact = new Map();
  const terms = new Map();
  let position = 0;
  let records = [];
  let catalog = [];
  async function compressed(path, value) {
    await writeFile(join(destination, path + '.bin'), gzipSync(JSON.stringify(value)));
  }
  async function flush() {
    if (!records.length) return;
    const shard = Math.floor((position - 1) / shardSize);
    await Promise.all([compressed('records/' + shard, records), compressed('catalog/' + shard, catalog)]);
    records = [];
    catalog = [];
  }

  await Promise.all(['records', 'catalog', 'exact', 'terms', 'lists'].map(folder =>
    mkdir(join(destination, folder), {recursive: true})
  ));
  await writeFile(join(destination, 'sources.json'), sourcesBytes);

  for (const file of descriptor.files) {
    const course = file.collection;
    assert(expected.has(course), course);
    assert.equal(file.file, 'bridgeassist-' + course.toLowerCase().replace(' ', '-') + '.jsonl.gz');
    const parts = file.parts ?? [file.file];
    assert(parts.length > 0 && parts.length < 10);
    for (const [i, part] of parts.entries()) {
      assert.equal(part, file.parts ? file.file + '.part' + (i + 1) : file.file);
    }
    async function* archiveBytes() {
      for (const filename of parts) yield* createReadStream(join(input, filename));
    }
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of archiveBytes()) { hash.update(chunk); size += chunk.length; }
    assert.equal(size, file.bytes);
    assert.equal(hash.digest('hex'), file.sha256, course);

    const start = position;
    const counts = {question: 0, practice: 0};
    const stream = createGunzip();
    const source = Readable.from(archiveBytes());
    source.on('error', error => stream.destroy(error));
    source.pipe(stream);
    const lines = createInterface({input: stream, crlfDelay: Infinity});
    for await (const line of lines) {
      const record = JSON.parse(line);
      const kind = record.record_kind;
      assert(Object.hasOwn(counts, kind), record.id);
      assert(course === 'RESOURCES' ? record.primary_collection === course : record.courses.includes(course), record.id);
      assert(!recordIds.has(record.id), 'Duplicate record ID ' + record.id);
      assert(record.question && record.first_tutoring_reply && record.reference_answer && record.worked_solution.length, record.id);
      assert(record.source_ids.length && record.source_ids.every(id => Object.hasOwn(sources, id)), record.id);
      const canonical = normalizeQuestion(record.question);
      const precise = exactQuestion(record.question);
      assert(!canonicalQuestions.has(precise), 'Duplicate question ' + record.id);
      recordIds.add(record.id);
      canonicalQuestions.add(precise);
      const earlier = exact.get(canonical);
      exact.set(canonical, earlier === undefined ? position : [].concat(earlier, position));
      const searchText = [record.question, record.topic, practiceSearchTerms[record.family_id]].filter(Boolean).join(' ');
      for (const term of libraryTokens(searchText)) {
        if (!terms.has(term)) terms.set(term, []);
        terms.get(term).push(position);
      }
      counts[kind]++;
      kindLists[kind].push(position);
      records.push(record);
      catalog.push([record.id, kind, collections.length, record.topic, record.question]);
      position++;
      if (records.length === shardSize) await flush();
    }
    assert.deepEqual([counts.question, counts.practice], expected.get(course), course);
    collections.push({course, start, end: position, ...counts});
    console.log('BridgeAssist indexed', course, position - start, 'records');
  }
  await flush();
  assert.equal(position, 150000);
  for (const [kind, list] of Object.entries(kindLists)) await compressed('lists/' + kind, list);
  for (const [name, index] of [['exact', exact], ['terms', terms]]) {
    const buckets = new Map();
    for (const [key, value] of index) {
      const bucket = bucketFor(key);
      if (!buckets.has(bucket)) buckets.set(bucket, Object.create(null));
      buckets.get(bucket)[key] = value;
    }
    for (let i = 0; i < 256; i++) {
      const bucket = i.toString(16).padStart(2, '0');
      await compressed(name + '/' + bucket, buckets.get(bucket) ?? {});
    }
  }
  const manifest = {total: position, questions: kindLists.question.length, practice: kindLists.practice.length,
    shardSize, pageSize, collections, sources: Object.keys(sources).length, status: 'draft'};
  await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest));
  console.log('BridgeAssist release verified', manifest.questions, 'questions and', manifest.practice, 'practice problems');
}

if (process.argv[2] === '--library-only') {
  await buildBridgeAssistLibrary(resolve(process.argv[3]), process.argv[4] ? resolve(process.argv[4]) : here);
}
