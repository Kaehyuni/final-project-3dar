import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {Readable} from 'node:stream';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createGunzip, gzipSync} from 'node:zlib';
import {buildLearnerPrompts} from './build-learner-prompts.mjs';

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
  'mass-to-particles': 'dimensional analysis mole Avogadro molar mass grams particles',
  'glycolysis-budget': 'glycolysis cellular respiration ATP NADH',
  'citric-carbon-carriers': 'citric acid cycle Krebs cycle cellular respiration ATP NADH',
  'calvin-resources': 'Calvin cycle photosynthesis carbon fixation ATP NADPH',
  'mitotic-index': 'mitotic index mitosis cell cycle',
  'meiosis-sample': 'meiosis ploidy diploid haploid chromosome chromatids',
  'inheritance-two-loci': 'Mendelian inheritance dihybrid cross Punnett square',
  'allele-counting': 'population genetics allele frequency genotype frequency',
  'hardy-recessive': 'Hardy Weinberg population genetics carrier frequency',
  'logistic-compare': 'logistic population growth carrying capacity',
  'demographic-balance': 'population growth birth death immigration emigration',
  'mark-recapture': 'mark recapture population size',
  'ecosystem-energy': 'ecosystem energy flow trophic level ten percent rule',
  'membrane-model': 'membrane transport diffusion osmosis tonicity',
  'enzyme-data': 'enzyme enzyme activity reaction rate',
  'dilution-aliquot': 'dilution molarity aliquot concentration',
  'displacement-density': 'density volume displacement',
  'isotope-mixture': 'isotope average atomic mass percent abundance',
  'empirical-formula': 'empirical formula molecular formula percent composition',
  'reaction-yield': 'percent yield theoretical yield limiting reactant stoichiometry'
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
    const binary=/^images\/study\/[a-z0-9-]+\.webp$/.test(file.path);
    assert(binary||/^(?:js\/[a-z-]+\.(?:js|mjs|css)|data\/(?:study-images|bridgeassist-library)\/[a-zA-Z0-9.-]+\.json|assistant\.html|study\/(?:bridgeassist-library\/index|practice|conversation)\.html)$/.test(file.path),file.path);
    assert.equal(file.encoding??'utf8',binary?'base64':'utf8',file.path);
    const content=binary?Buffer.from(file.content,'base64'):file.content;
    assert.equal(digest(content), file.sha256, file.path);
    await mkdir(dirname(join(publish, file.path)), {recursive: true});
    await writeFile(join(publish, file.path), content);
  }
  const archiveJob=[
    join(input,'build-tutoring-archive.mjs'),join(input,'tutoring-archive.jsonl.gz'),
    join(publish,'data','tutoring-archive','v1'),join(publish,'js','tutoring-archive.mjs')
  ];
  await new Promise((complete,fail)=>{
    const child=spawn(process.execPath,archiveJob,{stdio:'inherit',windowsHide:true});
    child.once('error',fail);
    child.once('close',code=>code===0?complete():fail(Error('Tutoring archive build failed with exit code '+code)));
  });
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
  const teachingComponents = new Map();
  const explanationTexts = new Set();
  let longerExplanations = 0;
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
      for(const explanation of [record.first_tutoring_reply,record.reference_answer,...record.worked_solution.map(step=>step.explanation)]){
        assert(typeof explanation==='string'&&explanation.trim(),record.id);
        if(!explanationTexts.has(explanation)){
          explanationTexts.add(explanation);
          if(explanation.length>600)longerExplanations++;
        }
      }
      if(kind==='question'&&course!=='RESOURCES'){
        const pieces = record.component_questions?.map((question,index)=>({
          question,
          answer:record.worked_solution[index]?.explanation,
          topic:question.match(/[“"]([^”"]+)[”"]/)?.[1]??record.worked_solution[index]?.title.replace(/^[A-C]\. /,''),
          course,sourceIds:record.claim_source_links[index]?.source_ids
        })) ?? [{question:record.question,answer:record.reference_answer,topic:record.topic,course,sourceIds:record.source_ids}];
        for(const component of pieces){
          const key=course+'|'+normalizeQuestion(component.question);
          if(component.answer&&component.topic&&component.sourceIds?.length&&!/\b(?:pathogen|virus|viral|bioweapon|synthesis screening|culturing)\b/i.test(component.question+' '+component.topic)&&!teachingComponents.has(key)){
            teachingComponents.set(key,component);
          }
        }
      }
      const canonical = normalizeQuestion(record.question);
      const precise = exactQuestion(record.question);
      assert(!canonicalQuestions.has(precise), 'Duplicate question ' + record.id);
      recordIds.add(record.id);
      canonicalQuestions.add(precise);
      const earlier = exact.get(canonical);
      exact.set(canonical, earlier === undefined ? position : [].concat(earlier, position));
      const topicTerms = [record.topic, practiceSearchTerms[record.family_id]].filter(Boolean).join(' ');
      const searchText = [record.question, topicTerms, ...(record.related_topics ?? []), ...(record.student_language_aliases ?? [])].join(' ');
      for (const term of libraryTokens(searchText)) {
        if (!terms.has(term)) terms.set(term, []);
        terms.get(term).push(position);
      }
      counts[kind]++;
      kindLists[kind].push(position);
      records.push(record);
      catalog.push([record.id, kind, collections.length, record.topic, record.question, record.family_id, topicTerms]);
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
  const modules=await Promise.all([
    import(pathToFileURL(join(publish,'js','learner-foundations.mjs'))),
    import(pathToFileURL(join(publish,'js','learner-methods.mjs')))
  ]);
  for(const row of [...modules[0].foundations,...modules[1].methodGuides]){
    const sources=row.sources??[{title:row.source?.[0],url:row.source?.[1]}];
    if(!sources.length||!sources.every(source=>source.title&&/^https:\/\//.test(source.url)))continue;
    const courseList=(row.courses??[]).filter(course=>expected.has(course)&&course!=='RESOURCES');
    for(const course of courseList.length?courseList:[row.id.includes('mitotic')||row.id.includes('photosynth')||row.id.includes('respiration')?'BIOL 1406':'CHEM 1411']){
      const subject=row.title;
      const core=[
        ['Can you explain '+subject+' in plain language?',row.answer??row.summary],
        ['Why does '+subject+' matter?',row.why],
        ['Can you give me a simple example for '+subject+'?',row.example],
        ['How should I start a problem about '+subject+'?',row.steps?.join(' ')],
        ['What formula should I use for '+subject+'?',row.formula&&(row.formula+'\n'+(row.answer??row.summary))]
      ];
      for(const [question,answer] of core){
        if(answer)teachingComponents.set(course+'|'+normalizeQuestion(question),{question,answer,topic:subject,course,sources,priority:true});
      }
    }
  }
  const learner=await buildLearnerPrompts({destination:join(publish,'data','learner-prompts','v1'),
    components:[...teachingComponents.values()],occupied:new Set(exact.keys()),normalize:normalizeQuestion,bucketFor,sources});
  console.log('BridgeAssist additional learner phrasings',JSON.stringify(learner));
  console.log('Audited original explanation fields:',explanationTexts.size,'unique texts,',longerExplanations,'longer than 600 characters.');
  const python=process.env.BRIDGEASSIST_BUILD_PYTHON||'python3';
  await new Promise((complete,fail)=>{
    const child=spawn(python,[join(input,'build-learner-practice.py'),'--prior',input,'--publish',publish],
      {stdio:'inherit',windowsHide:true});
    child.once('error',fail);
    child.once('close',code=>code===0?complete():fail(Error('Practice build failed with exit code '+code)));
  });
}

if (process.argv[2] === '--library-only') {
  await buildBridgeAssistLibrary(resolve(process.argv[3]), process.argv[4] ? resolve(process.argv[4]) : here);
}
