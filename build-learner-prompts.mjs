import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';

const foundationCourse = 'BIOL 1406';
const foundationSize = 20000;
const perCourseSize = 60000;
const courses = ['BIOL 1406', 'BIOL 1407', 'CHEM 1405', 'CHEM 1406', 'CHEM 1411'];
const learnerFocus = /\b(?:mitos\w*|interphas\w*|cell cycle|cytokinesis|monomer\w*|polymer\w*|macro[m-]?\w*|biomolecule\w*|functional group\w*|carbohydrate\w*|protein\w*|nucleic acid\w*|lipid\w*)\b/i;

// Keep the scientific question intact when changing the learner's wording.
// Prompts are original. The search and tutoring studies inform prompt styles,
// while the source links on each answer support the course content itself.
const frames = [
  '',
  "I'm stuck on this",
  'Can you help me with this',
  'This is on my review sheet',
  'Quick question from class',
  'Can you help me understand this',
  "I'm reviewing for class",
  "I can't remember this from lecture",
  'Could you help me review this',
  "I don't understand this part of my notes",
  'This was on my practice quiz',
  "I'm trying to study this on my own",
  'This is the part I keep mixing up',
  'One thing I missed in class',
  "I'm going over the basics again",
  "Here's the part I'm confused about",
  'Can you clear something up for me',
  'I have a question from my study guide',
  "I'm catching up on the reading",
  'I need to make sense of this question',
  'I want to check what this means',
  'Can you go over this with me',
  "I think I missed something in class",
  'Help me understand the idea here',
  "I can't quite explain this yet"
];
const styles = [
  '',
  'Please use simple words.',
  'Can you make it easier to understand?',
  'I need the main idea first.',
  'Please break down the key idea.',
  "I'm still learning the terms.",
  'A short explanation would help.',
  'Explain it like I just started this topic.',
  'Could you put it in plain language?',
  'Can you explain the important part?',
  'Help me make sense of it.',
  "I'm new to this chapter.",
  'Can you keep it brief?',
  'I want to understand it well enough to explain it.',
  "I'm trying to follow the idea in my notes.",
  'Could you explain that clearly?',
  'I know the word but I get stuck on the idea.',
  'Please use everyday language where you can.',
  'A beginner explanation would be great.',
  'Could you say what this means in class?',
  'Can you give me the big picture first?'
];
const conversationOpeners = [
  '',
  'Wait, let me ask it another way',
  'I need to go back a step',
  'I got lost at this part',
  'I think this is the part I missed',
  "I'm trying to say this in my own words",
  'I keep mixing up the wording',
  'I looked at my notes and I still have a question',
  "I'm not sure I got the point",
  "I don't know how to put my answer into words",
  'I can read the question but I need help with the idea',
  'I was following until I got to this',
  "I'm studying on my phone and got stuck here",
  'My next question is about this part',
  'I want to make sure I learned this right',
  "I think I know the term, but I'm still stuck",
  'I just started reviewing this section',
  'My study partner and I got stuck on this',
  'This is where my notes stop making sense',
  'Can we slow down for a second',
  'Let me try the question again',
  'I meant to ask this first',
  'Can we go over this before I move on',
  'I almost have it, but this part is fuzzy',
  'I want to check this before my quiz',
  'I forgot how we talked about this in class',
  "I'm reading my review notes and have a question",
  'I need to explain this to my study group',
  'I have one more question to check',
  'This came up when I was going over my notes',
  "I'm trying to get the basics straight",
  "I'm back at the part I didn't understand",
  'Please pause here while I check something',
  'Can we back up to this',
  'This part is probably easy once it clicks',
  'I tried explaining this and got stuck',
  'Okay, here is what I am unsure about'
];
const conversationClosers = [
  '',
  'Could you help me get unstuck?',
  'Can you put that part in regular words?',
  'I just need enough to follow along.',
  'What is the part I should get straight?',
  'Can you say it the way a tutor would?',
  'I want to see if I can explain it back.',
  'Could you make the key idea clear for me?',
  'I keep overthinking the wording.',
  "I'm having trouble making sense of my notes.",
  'I want to know what that means before I move on.',
  'Can you walk me through the idea at a basic level?',
  "I can't tell what I'm supposed to remember.",
  'I need an answer I can follow.',
  'Could you explain the term if you have to use it?',
  'What would you tell me if we were studying together?',
  "I don't have the earlier part of my notes with me.",
  'Can we start with the point I need to understand?',
  'I want to be able to say it without reading the book.',
  'Could you keep the explanation focused on that?',
  'It stops making sense to me right there.',
  'Can you help me sort that out?',
  "I'm trying to get where I'm going wrong.",
  'I want to understand this rather than memorize a line.',
  'Can you explain this without adding extra terms first?',
  'What should I understand when I read that question?',
  'I want to make sure I can recognize it on a quiz.',
  'My notes leave out the connection.',
  'I can follow a short answer first.',
  'I would appreciate a clear starting point.',
  'Could you write that the way you would say it out loud?',
  'I need to know what to put in my study notes.',
  'Please focus on what the question is asking.',
  "I want to see whether I've got the right idea.",
  'Can you help me understand what the wording is getting at?'
];

function plainQuestion(question) {
  return question.trim().replace(/\s+/g, ' ').replace(/[?!.]+$/, '');
}

function questionForms(question) {
  const stem = plainQuestion(question);
  const forms = new Set([stem]);
  const name = stem.match(/^For [“"]([^”"]+)[”"] in (.+), explain how to recognize it$/i);
  if (name) {
    forms.add('How can I recognize ' + name[1] + ' in ' + name[2]);
    forms.add('What clues tell me that I am looking at ' + name[1] + ' when studying ' + name[2]);
    forms.add('How would I identify ' + name[1] + ' in ' + name[2]);
  }
  const role = stem.match(/^For [“"]([^”"]+)[”"] in (.+), explain (?:its |the )?role$/i);
  if (role) {
    forms.add('What role does ' + role[1] + ' have in ' + role[2]);
    forms.add('What does ' + role[1] + ' do in ' + role[2]);
  }
  const significance = stem.match(/^What is the significance of [“"]([^”"]+)[”"] in the study of (.+)$/i);
  if (significance) {
    forms.add('Why does ' + significance[1] + ' matter when learning about ' + significance[2]);
    forms.add('What makes ' + significance[1] + ' important in ' + significance[2]);
    forms.add('Why should I pay attention to ' + significance[1] + ' in ' + significance[2]);
  }
  const sequence = stem.match(/^(?:What are|List|Name) the (stages|phases|steps) of (.+)$/i);
  if (sequence) {
    forms.add(capitalize(sequence[1]) + ' of ' + sequence[2]);
    forms.add('Which ' + sequence[1] + ' are part of ' + sequence[2]);
    forms.add('What comes first and what comes next in ' + sequence[2]);
  }
  const definition = stem.match(/^What is ((?:an? )?[a-z][\w -]{1,45})$/i);
  if (definition && !/\b(?:the|of|for|in|if|when|where|from|during|to|vs|without|with|is|are)\b/i.test(definition[1])) {
    const term = definition[1].replace(/^an? /i, '');
    forms.add("What's " + definition[1]);
    forms.add('What does ' + term + ' mean');
    forms.add('How would you define ' + term);
  }
  if (/^How (?:do|can) (?:I|we) /i.test(stem)) {
    forms.add(stem.replace(/^How (?:do|can) (?:I|we) /i, 'What is the way to '));
    forms.add(stem.replace(/^How (?:do|can) (?:I|we) /i, 'Could you show me how to '));
  }
  if (/^What is the (?:formula|equation) for /i.test(stem)) {
    forms.add(stem.replace(/^What is the (formula|equation) for /i, '$1 for '));
    forms.add(stem.replace(/^What is the (formula|equation) for /i, 'Which $1 do I use for '));
  }
  return [...forms];
}

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

function* variants(question) {
  const forms = questionForms(question);
  for (const form of forms.slice(1)) yield form + '?';
  // Search fragments and direct learner phrasing come before longer turns.
  for (const form of forms) {
    for (const frame of frames.slice(1)) yield frame + '. ' + form + '?';
    for (const style of styles.slice(1)) yield form + '? ' + style;
  }
  for (const form of forms) {
    for (const frame of frames.slice(1)) {
      for (const style of styles.slice(1)) yield frame + '. ' + form + '? ' + style;
    }
  }
}

function* conversationalVariants(question) {
  const forms = questionForms(question);
  for (const form of forms) {
    for (const opener of conversationOpeners.slice(1)) yield opener + '. ' + form + '?';
    for (const closer of conversationClosers.slice(1)) yield form + '? ' + closer;
  }
  for (const form of forms) {
    for (const opener of conversationOpeners.slice(1)) {
      for (const closer of conversationClosers.slice(1)) yield opener + '. ' + form + '? ' + closer;
    }
  }
}

function collectSources(component, sources) {
  const inline = Array.isArray(component.sources)
    ? component.sources
    : component.sources ? [component.sources] : [];
  const references = [...inline, ...(component.sourceIds ?? []).map(id =>
    sources instanceof Map ? sources.get(id) : sources?.[id])];
  const byUrl = new Map();
  for (const source of references) {
    if (!source || typeof source.title !== 'string' || typeof source.url !== 'string') continue;
    let url;
    try { url = new URL(source.url); } catch { continue; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    byUrl.set(source.url, {title: source.title.trim(), url: source.url});
  }
  return [...byUrl.values()].filter(source => source.title);
}

function canonicalEntries(components, sources, normalize) {
  const byCourse = new Map(courses.map(course => [course, new Map()]));
  for (const component of components) {
    const byQuestion = byCourse.get(component.course);
    const question = component.question?.trim();
    const answer = component.answer?.trim();
    const topic = component.topic?.trim();
    if (!byQuestion || !question || !answer || !topic || question.length > 400 || answer.length > 5000) continue;
    const references = collectSources(component, sources);
    if (!references.length) continue;
    const promptKey = normalize(question);
    const current = byQuestion.get(promptKey);
    if (current && !component.sources) continue;
    // A supplied lesson card with explicit references takes precedence over
    // an older component phrasing from the same course.
    const hash = createHash('sha256')
      .update(JSON.stringify([question, topic, answer, references]))
      .digest('hex').slice(0, 24);
    byQuestion.set(promptKey, {
      value: {id: 'student-' + hash, topic, question, answer, sources: references},
      preferred: Boolean(component.sources) || learnerFocus.test(question + ' ' + topic),
      phrases: variants(question),
      conversation: conversationalVariants(question)
    });
  }
  return byCourse;
}

export async function buildLearnerPrompts({destination, components, occupied, normalize, bucketFor, sources}) {
  const byCourse = canonicalEntries(components, sources, normalize);
  const prompts = new Map();
  const answers = new Map();
  const counts = Object.fromEntries(courses.map(course => [course, 0]));
  const bins = Array.from({length: 256}, (_, index) => index.toString(16).padStart(2, '0'));
  const forbidden = new Set([...occupied].map(normalize));
  const topicSamples = new Set();

  function admit(cursor, course, limit, cohortCounts, phraseType) {
    let added = 0;
    let active = cursor;
    while (added < limit && active.length) {
      const remaining = [];
      for (const item of active) {
        const candidate = item[phraseType].next();
        if (candidate.done) continue;
        remaining.push(item);
        const query = normalize(candidate.value);
        if (query && !forbidden.has(query) && !prompts.has(query)) {
          prompts.set(query, item.value.id);
          answers.set(item.value.id, item.value);
          counts[course]++;
          if (cohortCounts) cohortCounts[course]++;
          topicSamples.add(item.value.topic);
          added++;
        }
        if (added >= limit) break;
      }
      active = remaining;
    }
    return added;
  }

  const biology = [...byCourse.get(foundationCourse).values()];
  const preferred = biology.filter(entry => entry.preferred);
  let foundations = admit(preferred, foundationCourse, foundationSize, null, 'phrases');
  if (foundations < foundationSize) {
    foundations += admit(biology, foundationCourse, foundationSize - foundations, null, 'phrases');
  }
  assert.equal(foundations, foundationSize, 'Insufficient sourced Biology 1406 questions for foundation expansion.');
  const foundationAnswers = answers.size;

  const targetAdditional = perCourseSize * courses.length;
  function addCohort(phraseType) {
    const perCourse = Object.fromEntries(courses.map(course => [course, 0]));
    const pools = [...byCourse].map(([course, entries]) => ({course, entries: [...entries.values()], hasMore: true}));
    let total = 0;
    for (const pool of pools) {
      const added = admit(pool.entries, pool.course, perCourseSize, perCourse, phraseType);
      assert(added > 0, 'Missing sourced learner question variations for ' + pool.course);
      pool.hasMore = added === perCourseSize;
      total += added;
    }
    while (total < targetAdditional) {
      const available = pools.filter(pool => pool.hasMore);
      assert(available.length, 'Insufficient unique sourced prompts for the full learner expansion.');
      const share = Math.ceil((targetAdditional - total) / available.length);
      for (const pool of available) {
        const request = Math.min(share, targetAdditional - total);
        if (!request) break;
        const added = admit(pool.entries, pool.course, request, perCourse, phraseType);
        pool.hasMore = added === request;
        total += added;
      }
    }
    return {total, perCourse};
  }

  const additional = addCohort('phrases');
  const conversational = addCohort('conversation');
  assert.equal(prompts.size, 620000);
  const byPrompt = new Map(bins.map(bin => [bin, Object.create(null)]));
  const byAnswer = new Map(bins.map(bin => [bin, Object.create(null)]));
  for (const [query, id] of prompts) byPrompt.get(bucketFor(query))[query] = id;
  for (const [id, answer] of answers) byAnswer.get(bucketFor(id))[id] = answer;
  await Promise.all(['prompt', 'answer'].map(directory => mkdir(join(destination, directory), {recursive: true})));
  let promptBytes = 0;
  let answerBytes = 0;
  for (const bin of bins) {
    const promptData = gzipSync(JSON.stringify(byPrompt.get(bin)));
    const answerData = gzipSync(JSON.stringify(byAnswer.get(bin)));
    await Promise.all([
      writeFile(join(destination, 'prompt', bin + '.bin'), promptData),
      writeFile(join(destination, 'answer', bin + '.bin'), answerData)
    ]);
    promptBytes += promptData.length;
    answerBytes += answerData.length;
  }
  const metadata = {
    total: prompts.size,
    foundation: foundations,
    additional: additional.total,
    conversational: conversational.total,
    foundationCourse,
    foundationAnswers,
    answers: answers.size,
    topics: topicSamples.size,
    perCourse: counts,
    cohortCourses: {additional: additional.perCourse, conversational: conversational.perCourse},
    buckets: bins.length,
    promptBytes,
    answerBytes,
    promptFormat: 'normalized question to answer ID',
    answerFormat: 'answer ID to sourced shared explanation',
    generation: 'Original learner-style variations of existing and newly authored course questions'
  };
  await writeFile(join(destination, 'prompt-manifest.json'), JSON.stringify(metadata));
  console.log('BridgeAssist learner prompt expansion', metadata);
  return metadata;
}
