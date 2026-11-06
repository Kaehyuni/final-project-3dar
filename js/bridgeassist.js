import {rankQuestions,routeQuery,normalize,tokens,publicationStatus} from './study-engine.js';
import {addChart} from './charts.js';
let corpusPromise,syllabiPromise;
const loadCorpus=()=>corpusPromise||=fetch('data/study-content.json').then(r=>{if(!r.ok)throw Error('Study content unavailable');return r.json()});
const loadSyllabi=()=>syllabiPromise||=fetch('data/syllabi.json').then(r=>{if(!r.ok)throw Error('Syllabus data unavailable');return r.json()});
const services=[['Library services & equipment loans','https://www.dallascollege.edu/resources/learning-commons/library/'],['Library catalog','https://dcccd.primo.exlibrisgroup.com/discovery/search?lang=en&vid=01DCCCD_INST%3A01DCCCD_INST'],['Research databases','https://libguides.dcccd.edu/az/databases'],['Academic catalog','https://catalog.dallascollege.edu/'],['Academic testing','https://www.dallascollege.edu/resources/testing-centers/academic-testing/'],['Success coaching','https://www.dallascollege.edu/resources/success-coaching/'],['Counseling services','https://www.dallascollege.edu/resources/counseling/']];
function a(text,url){const el=document.createElement('a');el.textContent=text;el.href=url;el.target='_blank';el.rel='noopener noreferrer';return el}
function mount(host,{dialog=false}={}){
 host.innerHTML=`<div class="assistant-body"><p class="assistant-caption">BridgeAssist finds explanations in sourced study content and public course records. It runs locally, without a hosted AI model or live browsing. Check the citations and your course materials. Chat stays in this tab.</p><div class="chat-log" role="log" aria-label="Conversation" aria-live="polite"></div><p class="chat-working" hidden role="status">Finding relevant study material</p><form class="chat-form"><label>Ask BridgeAssist<textarea required maxlength="2000" placeholder="Ask about a cell part, a chemistry concept, or a syllabus"></textarea></label><div class="chat-actions"><button type="button" class="clear-chat">Clear conversation</button><button type="submit" class="button primary">Send question</button></div></form><p class="small">For biology and chemistry learning. College services open on official websites.</p></div>`;
 const log=host.querySelector('.chat-log'),form=host.querySelector('form'),input=host.querySelector('textarea'),working=host.querySelector('.chat-working'),send=form.querySelector('[type=submit]');let context='',lastQuestion=null,busy=false,offTopic=0,epoch=0;
 function message(role,text){const div=document.createElement('article');div.className='chat-message '+role;const h=document.createElement('h3');h.textContent=role==='user'?'You':'BridgeAssist';const p=document.createElement('p');p.textContent=text;div.append(h,p);log.append(div);return div}
 function links(host,items){const div=document.createElement('div');div.className='source-links';for(const [title,url]of items)div.append(a(title,url));host.append(div)}
 function scroll(){log.scrollTop=log.scrollHeight}
 async function answer(text){
  if(busy)return;const clean=text.trim();if(!clean)return;busy=true;const requestEpoch=epoch;message('user',clean);input.value='';working.hidden=false;send.disabled=true;scroll();
  try{
   const route=routeQuery(clean);let el;
   if(route==='crisis'){
    el=message('assistant','I’m sorry you’re dealing with this. Your safety matters. BridgeAssist cannot provide crisis counseling. If you may act on thoughts of harming yourself or cannot stay safe, seek immediate help from a person near you or emergency services. In the United States, you can call or text the 988 Suicide & Crisis Lifeline.');
    links(el,[['Call 988','tel:988?oai_link_source=model_response_hotline'],['Text 988','sms:988?oai_link_source=model_response_hotline'],['988 online chat','https://988lifeline.org/chat/?oai_link_source=model_response_hotline'],['Dallas College counseling','https://www.dallascollege.edu/resources/counseling/']]);
   }else if(route==='counseling'){
    el=message('assistant','You deserve support with this. BioBridge is an independent study resource and cannot provide counseling. Dallas College’s counseling page lists its current services and contact options. If you are in emotional distress or a suicidal crisis in the United States, the 988 Suicide & Crisis Lifeline is available by phone or text.');links(el,[['Dallas College counseling','https://www.dallascollege.edu/resources/counseling/'],['Call 988','tel:988?oai_link_source=model_response_hotline'],['Text 988','sms:988?oai_link_source=model_response_hotline']]);
   }else if(route==='office-hours'){
    el=message('assistant','Office hours are not included here. Check the current syllabus or ask your instructor directly. You can search published course records and professional contact information in the syllabus tool.');links(el,[['Find a syllabus or contact','syllabi.html'],['Official syllabus information','https://www.dallascollege.edu/about/legal/hb2504/']]);
   }else if(route==='services'){
    el=message('assistant','BioBridge is not affiliated with Dallas College. I can help you find the official service, but cannot book testing appointments, reserve or rent equipment, access library accounts, or manage college services. Choose the appropriate Dallas College resource below.');const q=normalize(clean);const relevant=/test|appointment/.test(q)?[services[4]]:/success.?coach/.test(q)?[services[5]]:/database/.test(q)?[services[2]]:/catalog/.test(q)?[services[1],services[3]]:/library|calculator|borrow|rent|loan/.test(q)?[services[0],services[1]]:services;links(el,relevant);
   }else if(route==='syllabus'){
    const data=await loadSyllabi();if(requestEpoch!==epoch)return;
    const terms=tokens(clean).filter(t=>!['syllabus','syllabi','professor','instructor','faculty','compare','contact','email','phone','spring','2027','class','classes','information','info','details','dr','prof','find','show','topics','go','over','number','s'].includes(t));
    const matches=data.sections.filter(s=>{const hay=normalize([s.course,s.title,s.instructor,s.section].join(' '));return terms.length&&terms.every(t=>hay.includes(t))}).slice(0,4);
    el=message('assistant',matches.length?'These are matching public course records. Publication status and dates are specific to each record. Open the comparison tool for more results and side-by-side details.':'Use the syllabus tool to search public Spring 2027 records by course or professor and select records to compare. Coverage is incomplete: a listed class may not yet have a published syllabus. Older calendars remain labeled with their original term.');
    for(const s of matches){const p=document.createElement('p');p.textContent=[s.course,s.section,s.instructor,s.term,publicationStatus(s)==='published'?'Published syllabus':'Listed class; syllabus availability unknown'].filter(Boolean).join(' · ');el.append(p);if(s.contact?.email){const c=document.createElement('p');c.textContent='Published professional contact: '+s.contact.email+' (source term: '+s.contact.term+')';el.append(c)}if(s.contact?.phone){const p=document.createElement('p');p.textContent='Published phone: '+s.contact.phone+' (source term: '+s.contact.term+')';el.append(p)}if(/phone/i.test(clean)&&!s.contact?.phone){const p=document.createElement('p');p.textContent='A verified phone number is not included in this snapshot.';el.append(p)}links(el,[[publicationStatus(s)==='published'?'Source syllabus':'Source course listing',publicationStatus(s)==='published'?s.syllabusUrl:s.sourceUrl]])}
    links(el,[['Search & compare syllabi','syllabi.html'],['Dallas College syllabus gateway','https://www.dallascollege.edu/about/legal/hb2504/']]);
   }else{
    const data=await loadCorpus();if(requestEpoch!==epoch)return;
    let query=clean;if(/^(tell me more|explain more|more detail|why|how so)[?! .]*$/i.test(clean)&&lastQuestion)query=lastQuestion.question+' '+clean;
    const specificPart=/structure and function of /i.test(query)?data.parts.find(p=>normalize(query).endsWith(normalize(p.name))):null;
    const ranked=rankQuestions(query,data.questions,context),top=specificPart?{score:100,coverage:1,item:{question:query,answer:specificPart.summary+'\n\n'+specificPart.detail+'\n\nWhat it is made of: '+specificPart.components,misconception:specificPart.misconception,sources:specificPart.sources,followups:[]}}:ranked[0];
    if(top&&top.score>=6&&top.coverage>=.35){
     lastQuestion=top.item;offTopic=0;el=message('assistant',top.item.answer+(top.item.explanation?'\n\n'+top.item.explanation:''));
     if(top.item.misconception){const p=document.createElement('p');p.className='concept-note';p.textContent=top.item.misconception;el.append(p)}
     links(el,top.item.sources.map(id=>data.sources.find(s=>s.id===id)).filter(Boolean).map(s=>[s.title,s.url]));
     if(top.item.chart)addChart(el,top.item.chart);
     if(top.item.followups?.length){const div=document.createElement('div');div.className='followups';for(const q of top.item.followups.slice(0,2)){const b=document.createElement('button');b.type='button';b.textContent=q;b.addEventListener('click',()=>answer(q));div.append(b)}el.append(div)}
    }else{
     const science=/cell|biolog|chemi|mole|atom|bond|acid|base|enzyme|protein|dna|rna|respirat|ferment|diffus|osmo|genetic|ecolog|evol|plant|organ|ph |reaction|electron|mito|photosynth|membrane|nucle/.test(normalize(clean));
     offTopic+=science?0:1;
     el=message('assistant',science?'I don’t have a well-matched, sourced answer for that question yet. Try naming the process or the step that is confusing. I can help with cell structure, transport, macromolecules, respiration, genetics, and core chemistry.':offTopic>1?'BridgeAssist is limited to biology, chemistry, public syllabus information, and college service referrals. Please keep your next question within that scope.':'I can help with biology and chemistry study questions, public syllabi, and links to college services. What science topic are you working on?');
     links(el,[['Explore the cell lesson','cell.html'],['Study resources','resources.html']]);
    }
   }
  }catch(error){if(requestEpoch===epoch)message('assistant','The local study material could not load. Please try again or open the study resources. No question has been sent to an AI service.');}
  finally{busy=false;working.hidden=true;send.disabled=false;scroll();input.focus()}
 }
 form.addEventListener('submit',e=>{e.preventDefault();answer(input.value)});
 host.querySelector('.clear-chat').addEventListener('click',()=>{epoch++;log.replaceChildren();lastQuestion=null;offTopic=0;context='';input.value='';input.focus()});
 return {ask:answer,focus:()=>input.focus(),setContext:value=>{context=value||''}};
}
let modal,modalAPI;
function openAssistant(question,partId){
 if(!modal){modal=document.createElement('dialog');modal.className='assistant-dialog';modal.setAttribute('aria-labelledby','assistant-dialog-title');modal.innerHTML='<div class="assistant-head"><h2 id="assistant-dialog-title">BridgeAssist</h2><button aria-label="Close BridgeAssist">Close</button></div><div data-assistant-modal></div>';document.body.append(modal);modalAPI=mount(modal.querySelector('[data-assistant-modal]'),{dialog:true});modal.querySelector('.assistant-head button').addEventListener('click',()=>modal.close());modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close()}})}
 if(!modal.open)modal.showModal();modalAPI.setContext(partId);if(question)modalAPI.ask(question);else modalAPI.focus();
}
const inline=document.querySelector('[data-assistant]');if(inline)mount(inline);
else{const launch=document.createElement('button');launch.className='assistant-launch';launch.textContent='Ask BridgeAssist';launch.addEventListener('click',()=>openAssistant());document.body.append(launch)}
document.querySelector('#home-assist-form')?.addEventListener('submit',e=>{e.preventDefault();openAssistant(document.querySelector('#home-question').value)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-ask]');if(b)openAssistant(b.dataset.ask)});
window.addEventListener('bridgeassist:open',e=>openAssistant(e.detail?.question,e.detail?.partId));
