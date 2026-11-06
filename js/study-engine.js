export const normalize=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const stop=new Set('a an the is are was were be to of in on at and or with for i me my can could would should what why how does do tell explain about please into from it its this that there they their them we you your happen happens happening calculate calculated help understand need more function structure difference different'.split(' '));
export const tokens=s=>normalize(s).split(' ').filter(t=>t&&!stop.has(t));
const prepared=new WeakMap();
export function rankQuestions(query,questions,context=''){
 let index=prepared.get(questions);
 if(!index){const docs=questions.map(item=>({item,title:new Set(tokens(item.question)),aliases:new Set(tokens((item.aliases||[]).join(' '))),topics:new Set(tokens((item.topics||[]).join(' '))),body:new Set(tokens(item.answer))}));const df=new Map();for(const d of docs)for(const t of new Set([...d.title,...d.aliases,...d.topics,...d.body]))df.set(t,(df.get(t)||0)+1);index={docs,df};prepared.set(questions,index)}
 const q=normalize(query),terms=[...new Set(tokens(q))],ctx=normalize(context);
 const idf=t=>Math.log(1+(questions.length+.5)/((index.df.get(t)||0)+.5));
 return index.docs.map(d=>{const item=d.item,title=normalize(item.question),aliases=(item.aliases||[]).map(normalize);let score=title===q?100:aliases.includes(q)?90:0,matched=0;
 for(const term of terms){const forms=[term,term.replace(/s$/,''),term+'s'];const has=set=>forms.some(t=>set.has(t));const weight=idf(term);if(has(d.title)||has(d.aliases)||has(d.topics)){matched++;score+=weight*(has(d.title)?4:has(d.aliases)?3.5:2)}else if(has(d.body))score+=weight*.3;}
 if(terms.length>1&&matched===terms.length)score+=4;
 if(ctx&&item.partId===ctx)score+=2;
 return {item,score,matched,coverage:terms.length?matched/terms.length:0};}).sort((a,b)=>b.score-a.score);
}
export function routeQuery(text){
 const q=normalize(text);
 if(/suicid|kill myself|hurt myself|self harm|selfharm|end my life|want to die|don t want to live|do not want to live|end it all|unalive myself|cut myself|can t go on|cannot go on/.test(q))return 'crisis';
 if(/mental health|depress|anxiety|anxious|panic attack|counseling|counselling|therapist|overwhelmed|hopeless|can t cope|stressed out/.test(q))return 'counseling';
 if(/office hours|office hour/.test(q))return 'office-hours';
 if(/library|catalog|database|calculator.*(rent|loan|borrow)|(rent|loan|borrow).*calculator|testing appointment|book.*test|test.*appointment|success coach|successcoach|learning commons|rent.*resource/.test(q))return 'services';
 if(/syllab|professor|instructor|faculty|spring 2027|compare.*class|\bemail\b|\bcontact\b|\bphone\b/.test(q))return 'syllabus';
 return 'study';
}
export function acceptedLabel(answer,part){const a=normalize(answer);return [part.name,...part.aliases||[]].map(normalize).some(b=>a===b||a===b.replace(/s$/,''));}
export function publicationStatus(record){return record.status==='syllabus_published'&&record.syllabusStatus!=='not_found_in_public_library_snapshot'?'published':record.term==='2026 Fall'?'older':'listed';}
