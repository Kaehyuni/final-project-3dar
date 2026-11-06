import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {rankQuestions,routeQuery,acceptedLabel,publicationStatus} from '../js/study-engine.js';
const science=JSON.parse(readFileSync(new URL('../data/study-content.json',import.meta.url)));
const handouts=JSON.parse(readFileSync(new URL('../data/handouts.json',import.meta.url)));
const syllabi=JSON.parse(readFileSync(new URL('../data/syllabi.json',import.meta.url)));
test('crisis language routes before subject or service filtering',()=>{assert.equal(routeQuery('I want to die because I failed biology'),'crisis');assert.equal(routeQuery('I need mental health help with anxiety'),'counseling');assert.equal(routeQuery("I don't want to live anymore"),'crisis');assert.equal(routeQuery('I feel hopeless and overwhelmed'),'counseling')});
test('service and syllabus requests have separate scope routes',()=>{assert.equal(routeQuery('Can I borrow a calculator from the library?'),'services');assert.equal(routeQuery('Compare the syllabus for Professor Danesh'),'syllabus');assert.equal(routeQuery('What are the office hours?'),'office-hours');assert.equal(routeQuery('Why does osmosis happen?'),'study')});
test('canonical questions retrieve the correct sourced answer',()=>{for(const q of science.questions){const result=rankQuestions(q.question,science.questions)[0];assert.equal(result.item.id,q.id,q.question);assert.ok(result.coverage>=.35)}});
test('every answer and part has resolvable scientific sources',()=>{const ids=new Set(science.sources.map(s=>s.id));for(const item of [...science.questions,...science.parts]){assert.ok(item.sources.length);for(const id of item.sources)assert.ok(ids.has(id),id)}for(const s of science.sources)assert.match(s.url,/^https:\/\//)});
test('label checking accepts aliases and rejects unrelated organelles',()=>{const nucleus=science.parts.find(p=>p.id==='nucleus');assert.ok(acceptedLabel('Nucleus',nucleus));assert.equal(acceptedLabel('mitochondria',nucleus),false)});
test('all study guides exist with unique versioned activity IDs',()=>{const ids=new Set();for(const h of handouts.items){assert.ok(!ids.has(h.activity));ids.add(h.activity);assert.ok(h.activity.endsWith('-v1'));for(const path of [h.guideUrl||h.studentUrl])assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);assert.match(h.lessonUrl,/^https:\/\/khn-3dar-rlc\.com\/cell\.html\?activity=/)}});
test('syllabus publication is not inferred from a listing and prior calendars retain term',()=>{assert.equal(syllabi.coverage.complete,false);for(const s of syllabi.sections){assert.equal(s.term,'2027 Spring');if(!s.syllabusUrl)assert.notEqual(s.status,'syllabus_published')}for(const c of syllabi.comparisons.filter(c=>c.status==='older_reference_only'))assert.equal(c.term,'2026 Fall')});
test('office hours are not collected as course fields',()=>{function check(value){if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){assert.equal(/office.?hours/i.test(key),false);check(item)}}check(syllabi)});

test('natural topic queries retrieve the intended concept',()=>{for(const [query,id]of [['Why does water move into a cell?','transport-osmosis'],['How do I calculate molarity?','chem-molarity'],['Why does fermentation happen?','respiration-fermentation'],['What is a monomer?','bio-monomer-polymer']])assert.equal(rankQuestions(query,science.questions)[0].item.id,id,query)});

test('a redirect URL alone never implies a published syllabus',()=>{const listed=syllabi.sections.find(s=>s.status==='official_section_listed'&&s.syllabusUrl);assert.ok(listed);assert.equal(publicationStatus(listed),'listed');assert.equal(syllabi.sections.filter(s=>publicationStatus(s)==='published').length,syllabi.coverage.documentCount)});
