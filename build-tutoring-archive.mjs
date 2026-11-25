import {createReadStream, readFileSync} from 'node:fs';
import {mkdir, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createInterface} from 'node:readline';
import {createGunzip, gzipSync} from 'node:zlib';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const {archiveBucket,normalizeArchiveQuestion}=await import(pathToFileURL(
  process.argv[4]??path.join(here,'site','js','tutoring-archive.mjs')).href);
const input = process.argv[2] ?? path.join(here, 'tutoring-archive.jsonl.gz');
const output = process.argv[3] ?? path.join(here, 'site/data/tutoring-archive/v1');
const questionShards = new Map();
const recordShards = new Map();
const byUnit = new Map();
const ids = new Set();
const literal = new Set();
let manifest;
let exchanges = 0;

function shard(all, key) {
  const bucket = archiveBucket(key);
  if (!all.has(bucket)) all.set(bucket, Object.create(null));
  return all.get(bucket);
}

const source = createReadStream(input).pipe(createGunzip());
for await (const line of createInterface({input:source, crlfDelay:Infinity})) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  if (!manifest) {
    manifest = record;
    if (manifest.version !== 1 || manifest.acceptedExchanges !== 100_000 ||
        Object.keys(manifest.units).length !== 18 || Object.keys(manifest.demos).length !== 18) {
      throw new Error('Unexpected archive manifest');
    }
    continue;
  }
  if (!record.id || ids.has(record.id) || !Object.hasOwn(manifest.units,record.unit)
      || !Array.isArray(record.turns) || record.turns.length < 1 || record.turns.length > 13) {
    throw new Error('Invalid record identity or turns for ' + record.id);
  }
  const turns = new Set();
  for (const pair of record.turns) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(text=>typeof text!=='string'||!text.trim())) {
      throw new Error('Invalid question/answer pair for ' + record.id);
    }
    const key = normalizeArchiveQuestion(pair[0]);
    if (!key || turns.has(key)) throw new Error('Ambiguous context in ' + record.id);
    turns.add(key);
    literal.add(key);
  }
  const info = manifest.units[record.unit];
  const opener = normalizeArchiveQuestion(record.turns[0][0]);
  const questions = shard(questionShards,opener);
  if (!Object.hasOwn(questions,opener)) questions[opener] = Object.create(null);
  if (Object.hasOwn(questions[opener],info.course)) throw new Error('Ambiguous opener for ' + record.id);
  questions[opener][info.course] = record.id;
  shard(recordShards,record.id)[record.id] = record;
  ids.add(record.id);
  exchanges += turns.size;
  byUnit.set(record.unit,(byUnit.get(record.unit) ?? 0)+turns.size);
}

if (!manifest || exchanges !== manifest.acceptedExchanges || ids.size !== manifest.acceptedOpeners
    || manifest.acceptedFollowups !== exchanges - ids.size
    || manifest.uniqueNormalizedQuestions !== literal.size
    || [...byUnit].some(([key,value])=>manifest.acceptedByUnit[key]!==value)
    || Object.entries(manifest.demos).some(([unit,id])=>shard(recordShards,id)[id]?.unit!==unit)) {
  throw new Error('Archive records do not match manifest counts or example IDs');
}

const publish = async (file, bytes) => {
  const stage = file + '.tmp';
  await writeFile(stage,bytes);
  await rename(stage,file);
};
for (const [section, shards] of [['question',questionShards],['record',recordShards]]) {
  const directory = path.join(output,section);
  await mkdir(directory,{recursive:true});
  for (const [bucket,items] of shards) {
    await publish(path.join(directory,bucket+'.bin'),gzipSync(JSON.stringify(items),{level:9}));
  }
}

await publish(path.join(output,'manifest.json'),JSON.stringify({...manifest,
  questionShards:questionShards.size, recordShards:recordShards.size, encoding:'gzip'}));

if (!readFileSync(path.join(output,'manifest.json')).length) throw new Error('Could not write archive manifest');
console.log(JSON.stringify({exchanges, openers:ids.size, followups:exchanges-ids.size,
  uniqueNormalizedQuestions:literal.size, questionShards:questionShards.size, recordShards:recordShards.size}));
