import {addChart} from './charts.js';
import {rankQuestions} from './study-engine.js';
const id=new URLSearchParams(location.search).get('activity'),$=id=>document.getElementById(id);
try{
 const [manifest,science]=await Promise.all([fetch('data/handouts.json').then(r=>r.json()),fetch('data/study-content.json').then(r=>r.json())]);const item=manifest.items.find(i=>i.activity===id);if(!item)throw Error('Unknown activity');
 $('activity-title').textContent=item.title;$('activity-course').textContent=item.courses.join(' · ')+' · '+item.id+' · v'+item.version;$('activity-description').textContent=item.description;
 function link(title,url){const a=document.createElement('a');a.textContent=title;a.href=url;return a}
 for(const [title,url]of [['Study guide ↗',item.guideUrl||item.studentUrl],['Sources & creation notes ↗','credits.html?asset='+encodeURIComponent(item.id)]]){const a=link(title,url);a.className='button secondary';$('activity-downloads').append(a)}
 const questions=rankQuestions(item.title+' '+item.topic,science.questions).filter(r=>r.score>=3).slice(0,3).map(r=>r.item);
 for(const q of questions){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=q.question;details.append(summary);const p=document.createElement('p');p.textContent=q.answer;details.append(p);const sources=document.createElement('div');sources.className='source-links';for(const id of q.sources){const s=science.sources.find(s=>s.id===id);if(s)sources.append(link(s.title,s.url))}details.append(sources);$('activity-prompts').append(details)}
 if(id.includes('osmosis'))addChart($('activity-chart'),'osmosis');
 for(const sid of item.sourceIds){const s=manifest.sourceRecords.find(s=>s.id===sid);if(s)$('activity-sources').append(link(s.title,s.url))}
 $('activity-ask').addEventListener('click',()=>window.dispatchEvent(new CustomEvent('bridgeassist:open',{detail:{question:'Help me understand '+item.topic}})));
}catch{$('activity-title').textContent='Choose a study guide';$('activity-description').textContent='This activity was not found. Open the Handouts tab to choose a visual study guide.'}
