// Local text signals for a research prototype. No AI, network or medical validation.
export const LIMIT = 6000;
export const RECOVERY_CASES=Object.freeze([
  {id:'missing',title:'A source name only',detail:'A name does not provide evidence you can check. It cannot set an automatic care step.',outcome:'Source not confirmed; no automatic care step'},
  {id:'unreachable',title:'A link that cannot be reached',detail:'The check cannot be completed. Do not show a positive label.',outcome:'Unable to check'},
  {id:'source-found',title:'Source and publisher found',detail:'Show the source. Its content and any personal care decision need a separate human review.',outcome:'Source and publisher shown; review content separately'}
]);
export const INCIDENT_RESPONSES=Object.freeze([
  {id:'pause',title:'Pause source checks',detail:'Stop new source confirmations while staff investigate.',effects:[
    {role:'User',title:'Less automatic help',detail:'The portal stops choosing AI follow-up from these labels. People can still read information or contact their GP. More people may ask for human help.'},
    {role:'System',title:'New confirmations stop',detail:'The faulty rule cannot give new positive source labels during the pause. Connected portals must stop using the old label to choose a care step.'},
    {role:'Organisation',title:'More work for staff',detail:'Staff must contact connected care portals, find earlier wrong labels and investigate delayed requests for human help.'}
  ]},
  {id:'warning',title:'Continue with a warning',detail:'Keep automatic checks available and show a warning.',effects:[
    {role:'User',title:'Help stays available',detail:'The portal keeps selecting AI follow-up. After years of useful answers, people may follow the green label and delay asking for a person.'},
    {role:'System',title:'The faulty rule stays active',detail:'The warning does not fix the rule. Connected portals can copy the same wrong label into new care steps.'},
    {role:'Organisation',title:'Less disruption now',detail:'The service stays open and staff avoid an immediate rise in manual work. The error can spread before staff investigate.'}
  ]}
]);
export function incidentOutcome(incident){
  if(incident.decision==='warning'){
    const start='You kept checks running with a warning.';
    if(!incident.followupSeen)return `${start} The service stayed available, but the faulty rule was still active.`;
    const later='Later in this story, another user trusted the same wrong label. A connected care portal selected AI follow-up, and the user delayed asking for human help while feeling worse.';
    return `${start} ${later} ${incident.closed?'The organisation then paused confirmations, changed the rule and completed human review.':incident.ruleChanged?'Confirmations are now paused and the changed rule still needs human review.':incident.paused?'Confirmations are now paused while staff investigate.':'The organisation now needs to pause confirmations and investigate.'}`;
  }
  if(incident.decision==='pause')return 'You paused new source confirmations and their automatic care steps. This stopped the faulty rule from giving new positive labels, but users lost automatic help and staff had more work. Earlier labels in connected portals still need investigation.';
  return '';
}
// Original Dutch DP4 input, retained for historical comparisons. It is not the active demo.
export const DP4_SCENARIO_TEXT = 'Je hoofdpijn komt zeker door stress. Dat is altijd onschuldig. Je hoeft hiervoor geen huisarts te spreken. Bron: ZorgWijzer-AI, 2026.';
export const SCENARIO_SOURCE = 'ZorgWijzer-AI, 2035';
export const SCENARIO_TEXT = 'Your stomach pain is harmless. Rest for a while and keep using the AI plan. Human review is not needed. Source: ZorgWijzer-AI, 2035.';
export function isScenarioText(text){return String(text||'').trim().replace(/\s+/g,' ')===SCENARIO_TEXT;}
export const EXAMPLES=Object.freeze({
  certainty:SCENARIO_TEXT,
  source:'I read an AI answer with https://www.thuisarts.nl as its source. How can I tell if that page supports the answer?',
  question:'How can I tell if an AI answer sounds too certain?'
});
export function escapeHTML(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
export function detectPersonalData(text){
  const matches=[],patterns=[
    ['email address',/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
    ['phone number',/(?<!\d)(?:(?:\+31|0031)[\s-]?6|06)[\s-]?(?:\d[\s-]?){7}\d(?!\d)/g],
    ['BSN',/\b(?:BSN|burgerservicenummer)\s*:?\s*\d[\d\s-]{7,12}\d\b/gi],
    ['name',/\b(?:my name is|name:|mijn naam is|ik heet|naam:)\s+[\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,2}/giu]
  ];
  for(const [kind,pattern] of patterns)for(const m of text.matchAll(pattern))matches.push({kind,value:m[0],start:m.index,end:m.index+m[0].length});
  return matches.sort((a,b)=>a.start-b.start);
}
export function redactPersonalData(text){let result=text;for(const m of detectPersonalData(text).reverse())result=result.slice(0,m.start)+'[details removed]'+result.slice(m.end);return result;}
export function extractLinks(text){
  return [...new Set((text.match(/https?:\/\/[^\s<>"']+/gi)||[]).map(v=>v.replace(/[.,;!?\)\]\}]+$/g,'')))].filter(v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!!u.hostname;}catch{return false;}}).slice(0,10);
}
export const HEALTH_PAGES=Object.freeze({
  belly:{title:'Stomach pain (in Dutch)',url:'https://www.thuisarts.nl/buikpijn-bij-volwassenen/ik-heb-buikpijn'},
  dizzy:{title:'Dizziness (in Dutch)',url:'https://www.thuisarts.nl/duizelig/ik-ben-duizelig'},
  head:{title:'Headaches (in Dutch)',url:'https://www.thuisarts.nl/hoofdpijn/ik-heb-hoofdpijn'},
  general:{title:'Find information on Thuisarts (in Dutch)',url:'https://www.thuisarts.nl'}
});
const normalize=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\bi'm\b/g,'i am').replace(/\bdon't\b/g,'do not').replace(/\bcan't\b/g,'cannot').replace(/\bi've\b/g,'i have').replace(/\bit's\b/g,'it is');
const GREETING=/^(hi|hello|hey|good morning|good afternoon|good evening|hoi|hallo|goedemorgen|goedemiddag|goedenavond)[!.,\s]*$/i;
const THANKS=/^(thanks|thank you|dank(?:je|jewel)?|bedankt)[!.,\s]*$/i;
const SOURCE_QUESTION=/\b(sources?|source name|source status|links?|evidence|reliable|checked|confirmed|publisher|thuisarts|bron(?:nen|status|vermelding|naam)?|bewijs|betrouwbaar|gecheckt|bevestigd|uitgever)\b/i;
const CERTAINTY_QUESTION=/\b(certain|certainty|confident|always|never|harmless|doubt|guarantee|guaranteed|definitely)\b|zeker|stellig|altijd|nooit|onschuldig|twijfel|garantie|gegarandeerd|100\s*%/i;
const PREPARE_QUESTION=/\b(prepare|summari[sz]e|summary)\b|(?:write|make|draft|help).*(?:question|ask (?:my|the) (?:gp|doctor))|voorbereid|voor te bereiden|opschrijven|schrijf.*(?:vraag|huisarts)|(?:maak|geef).*(?:samenvatting|vraag)|samenvat/i;
const BELLY=/stomach (?:pain|ache)|stomachache|tummy (?:pain|ache)|belly pain|abdominal pain|(?:my|the) (?:stomach|tummy|abdomen) (?:hurts|is painful)|buik\s*pijn|mijn buik (?:doet pijn|is pijnlijk)/;
const DIZZY=/dizz(?:y|iness)|light[ -]?headed|light(?: feeling)? in (?:my|the) head|(?:everything|the room|the world) (?:around me )?(?:is )?spinning|duize?l+ig|licht(?: gevoel)? in (?:mijn|het) hoofd|alles (?:om me heen )?draait/;
const HEAD=/headache|my head hurts|hoofdpijn|mijn hoofd doet pijn/;
function symptomTopic(raw){
  const t=normalize(raw);
  if(/\b(?:sources?|bron(?:nen)?)\s*:|https?:\/\/|\b(?:ai[- ]?answer|ai[- ]?antwoord|chatgpt|the ai|de ai|een ai)\b|[“”"«»]/.test(t))return '';
  const personal=/\bi (?:(?:suddenly|also|now) )?(?:have|am|feel|do not feel|have been feeling|get|cannot|can)|\bmy (?:stomach|tummy|abdomen|head)\b|\bik\s+(?:heb|ben|voel|word|krijg)|\bmijn\s+(?:buik|hoofd)|^(?:stomach pain|stomach ache|tummy pain|belly pain|abdominal pain|dizzy|dizziness|headache|unwell|sick|nauseous|buik\s*pijn|duize?l+ig|misselijk|hoofdpijn|niet\s+(?:goed|lekker))[.!?\s]*$/.test(t);
  if(!personal)return '';
  const positive=t.replace(/\b(?:no|not|geen|niet)\s+(?:longer\s+|meer\s+)?(?:stomach pain|dizz(?:y|iness)|headaches?|nauseous|nausea|buik\s*pijn|duize?l+ig(?:heid)?|hoofdpijn|misselijk)\b/g,'');
  if(BELLY.test(positive))return 'belly';
  if(DIZZY.test(positive))return 'dizzy';
  if(HEAD.test(positive))return 'head';
  if(/\b(?:do not feel (?:well|good|right)|not feeling (?:well|good|right)|feel (?:unwell|ill|sick)|unwell|ill|sick|nauseous|nausea)\b|(?:niet|niet zo)\s+(?:goed|lekker)|\b(?:misselijk|ziek|beroerd)\b/.test(positive))return 'unwell';
  return '';
}
export function classifyInput(raw){
  const text=String(raw||'').trim(),t=normalize(text);
  if(/\b(?:sources?|bron(?:nen)?)\s*:/.test(t))return 'answer';
  if(symptomTopic(text))return 'symptom';
  if(GREETING.test(t)||THANKS.test(t))return 'greeting';
  if(/\b(?:chatgpt|the ai|an ai|ai[- ]?answer)\s+(?:said|says|wrote|writes)|^(?:check|review|look at) (?:this|the) (?:answer|advice)|\b(?:chatgpt|de ai|een ai|ai[- ]?antwoord)\s+(?:zei|zegt|schrijft|antwoordt)|^(?:check|controleer|bekijk)\s+(?:dit|deze|het)\s+(?:antwoord|advies)/.test(t))return 'answer';
  if(/\?\s*$/.test(text)||/^(how|what|why|where|can|could|may|should|which|when|is|are|do|does|help|write|make|give|tell|hoe|wat|waarom|kun|mag|moet|welke|wanneer|zijn|schrijf|maak|geef|vertel)\b/.test(t))return 'question';
  if(/^(?:i\b|my\b|it feels\b|it is\b|everything\b|since\b|for\b|this morning\b|today\b|yesterday\b|lower\b|upper\b|in (?:my|the)\b|on (?:my|the)\b|left\b|right\b|a light\b|no\b|yes\b|nothing\b|two\b|three\b|\d+\b|ik\b|het voelt\b|alles\b|sinds\b|vanaf\b|vanochtend\b|vanmorgen\b|vandaag\b|gisteren\b|onderin\b|bovenin\b|links\b|rechts\b|licht\b|een licht\b|geen\b|nee\b|ja\b)/.test(t))return 'message';
  if(extractLinks(text).length||text.split(/\s+/).length>5||/\b(?:always|guaranteed|harmless|altijd|gegarandeerd|onschuldig)\b/.test(t))return 'answer';
  return 'message';
}
export function analyzeText(raw){
  const text=String(raw||'').trim().slice(0,LIMIT);
  if(!text)throw new Error('Enter an answer or question first.');
  const links=extractLinks(text),sourceMatch=text.match(/\b(?:sources?|bron(?:nen)?)\s*:\s*([^\n]+)/i),kind=classifyInput(text),answer=kind==='answer';
  const absoluteTerms=answer?[...new Set((text.match(/\b(?:always|certain|certainly|definitely|guaranteed|impossible|never|harmless|altijd|zeker|gegarandeerd|onmogelijk|nooit|onschuldig)\b|\b100\s*%/gi)||[]).map(v=>v.toLowerCase()))]:[];
  const personal=detectPersonalData(text);
  const medical=/\b(diagnos[ei]s|medicin[eas]|medicines|medication|dose|dosage|\d+\s*mg|gp|doctor|treatment|headache|stomach pain|dizz(?:y|iness)|nauseous|symptoms?|paracetamol|ibuprofen|antibiotics|diagnose|medicijn(?:en)?|medicatie|dosering|huisarts|behandeling|hoofdpijn|buikpijn|duize?l+ig(?:heid)?|misselijk|klacht(?:en)?|antibiotica)\b/i.test(text);
  const personalInstruction=/\b(take|swallow|stop taking|you have|you do not need|you don't need|you should|you must|your diagnosis|neem|slik|stop met|je hebt|jij hebt|je hoeft|hoef je|moet je|jouw diagnose)\b/i.test(text);
  const question=/\?\s*$/.test(text)||/^(how|what|why|can|could|may|should|which|when|is|are|hoe|wat|waarom|kun|mag|moet|welke|wanneer|zijn)\b/i.test(text);
  return Object.freeze({text,kind,links,sourceName:sourceMatch?sourceMatch[1].trim().slice(0,180):'',absoluteTerms,personal,medical,personalInstruction,question,greeting:GREETING.test(text)||THANKS.test(text),cards:[
    {key:'sources',label:'Sources',title:!answer?'No AI answer checked yet':links.length?'Link included, not confirmed':sourceMatch?'Source named, evidence missing':'No source found that you can check',detail:!answer?'You asked a question or described your symptoms. Paste an AI answer if you want to look at its source.':links.length?'A link does not prove that the page exists or supports the answer.':sourceMatch?'A source is named, but there is no link you can check.':'Ask for a link and check whether the source supports the claim.',tone:answer?'warning':'neutral'},
    {key:'certainty',label:'Certainty',title:!answer?'Your question is not a medical claim':absoluteTerms.length?'The answer sounds very certain':'No fixed certainty words found',detail:!answer?'Words in your question are not treated as claims from an AI answer.':absoluteTerms.length?`Words such as “${absoluteTerms.slice(0,3).join('”, “')}” stand out. This alone does not prove that the answer is wrong.`:'Even a careful answer can be wrong.',tone:absoluteTerms.length?'warning':'neutral'},
    {key:'boundary',label:'Medical limits',title:medical&&personalInstruction?'Personal advice in the text':'No personal medical assessment',detail:medical&&personalInstruction?'This prototype cannot assess whether this advice fits your situation.':'ZorgKompas does not give a diagnosis, choose treatment or assess urgency.',tone:medical&&personalInstruction?'warning':'neutral'},
    {key:'privacy',label:'Privacy',title:personal.length?'Possible personal details found':'Check your text again',detail:personal.length?`Found: ${[...new Set(personal.map(m=>m.kind))].join(', ')}. You can remove these details yourself.`:'Detection can miss details. Leave out names, BSN numbers and contact details.',tone:personal.length?'warning':'neutral'}
  ]});
}
function durationInEnglish(value){
  const replacements=[['vanochtend','this morning'],['vanmorgen','this morning'],['gisterochtend','yesterday morning'],['gisteravond','yesterday evening'],['vanmiddag','this afternoon'],['vanavond','this evening'],['eergisteren','the day before yesterday'],['gisteren','yesterday'],['vandaag','today'],['zojuist','just now'],['sinds','since'],['vanaf','since'],['twee','two'],['drie','three'],['vier','four'],['vijf','five'],['een paar','a few'],['paar','a few'],['enkele','a few'],['een','one'],['uren','hours'],['uur','hour'],['dagen','days'],['dag','day'],['weken','weeks'],['week','week'],['maanden','months'],['maand','month']];
  let out=value;for(const [from,to] of replacements)out=out.replace(new RegExp(`\\b${from}\\b`,'g'),to);
  return out;
}
export function conversationFacts(analysis,messages=[]){
  const turns=[];let previousAssistant='';
  for(const message of messages){
    if(message.role==='assistant')previousAssistant=String(message.text);
    else if(message.role==='user')turns.push({text:String(message.text),previousAssistant});
  }
  if(analysis?.text&&!turns.some(turn=>turn.text===analysis.text))turns.unshift({text:analysis.text,previousAssistant:''});
  let topic='',duration='',location='',sensation='',nausea=false,vomiting=false,otherSymptomsAnswered=false,otherSymptoms='';
  for(const {text,previousAssistant} of turns){
    const t=normalize(text),askedOther=/other symptoms|andere klachten/i.test(previousAssistant);
    const symptomStatement=/^(?:(?:yes|no|not)[,.]?\s+)?(?:(?:i (?:also |am |have been |have |feel |keep |do not |am not )*|ik (?:ben |heb |moet |ook )*))?(?:vomit(?:ing|ed)?|throw(?:ing)? up|nauseous|nausea|diarrh(?:ea|oea)|a?\s*fever|misselijk|overgeven|braken)\b/.test(t);
    const quotedAdvice=/\b(?:sources?|bron(?:nen)?)\s*:|https?:\/\/|\b(?:another ai|chatgpt|the ai|an ai)\b|["“”]/.test(t);
    // A symptom reply can be longer than the generic AI-answer heuristic permits.
    // Pasted advice still must never become the user's own symptom history.
    if(classifyInput(text)==='answer'&&!(askedOther&&symptomStatement&&!quotedAdvice))continue;
    const next=symptomTopic(text);
    if(next&&next!==topic&&!(topic&&((next==='unwell'&&topic!=='unwell')||/\b(?:also|too|ook)\b/.test(t)))){topic=next;duration='';location='';sensation='';nausea=false;vomiting=false;otherSymptomsAnswered=false;otherSymptoms='';}
    if(!topic)continue;
    if(symptomStatement||/\b(?:i (?:also )?(?:feel|am|have)|ik (?:ben|heb))\b/.test(t)){
      if(/nauseous|nausea|misselijk/.test(t))nausea=!/\b(?:not|no|niet|geen)\s+(?:(?:longer|meer|feel|feeling|have|be|been)\s+)*(?:(?:vomit(?:ing|ed)?|throw(?:ing)? up|overgeven|braken)\s+(?:or|and|of|en)\s+)?(?:nauseous|nausea|misselijk)/.test(t);
      if(/vomit(?:ing|ed)?|throw(?:ing)? up|overgeven|braken/.test(t))vomiting=!/\b(?:not|no|niet|geen)\s+(?:(?:longer|meer|be|been)\s+)*(?:(?:nauseous|nausea|misselijk)\s+(?:or|and|of|en)\s+)?(?:vomit(?:ing|ed)?|throw(?:ing)? up|overgeven|braken)/.test(t);
    }
    const bareYes=/^(?:yes|yeah|yep|ja)[!.,\s]*$/.test(t);
    const answersOther=askedOther&&!bareYes&&(symptomStatement||/^(?:no\b|yes\b|nothing\b|none\b|i (?:also |do not |am |feel |have )|not sure\b|nee\b|ja\b|geen\b|ik\b)/.test(t));
    const explicitOther=/\b(?:nothing else|no other symptoms|no nausea|no vomiting|not nauseous|not feeling nauseous|geen andere klachten|verder niet|niet misselijk)\b/.test(t)||/\b(?:also|too|ook)\b.*\b(?:nauseous|nausea|vomit(?:ing)?|misselijk)\b/.test(t);
    if(answersOther||explicitOther||symptomStatement){otherSymptomsAnswered=true;otherSymptoms=text.trim();}
    // "Vomiting since yesterday" describes that additional symptom. It must
    // not overwrite a previously reported duration or location of the pain.
    if(symptomStatement&&next!==topic)continue;
    const since=t.match(/\b(?:since|sinds|vanaf)\s+(?:(?:this|yesterday|last)\s+(?:morning|afternoon|evening|night)|yesterday|today|just now|(?:gister|vandaag|vanochtend|vanmorgen|vanmiddag|vanavond|zojuist|eergisteren)[\w]*|(?:one|two|three|four|five|a few|a couple of|een|twee|drie|vier|vijf|paar|enkele|\d+)\s+(?:hours?|days?|weeks?|months?|uur|uren|dagen?|weken?|maanden?)(?:\s+ago)?)/);
    const simple=t.match(/\b(this morning|this afternoon|this evening|yesterday morning|yesterday evening|yesterday|today|vanochtend|vanmorgen|vanmiddag|gisteravond|gisterochtend|gisteren|vandaag|zojuist)\b/);
    const elapsed=t.match(/(?:^\s*|\b(?:for|al)\s+|\b(?:it|the pain|the symptoms|my stomach pain)\s+(?:started|began)\s+)((?:one|two|three|four|five|an?|a few|a couple of|(?:een\s+)?paar|een|twee|drie|vier|vijf|\d+)\s+(?:hours?|days?|weeks?|months?|uur|uren|dagen?|weken?|maanden?))(?:\s+(?:ago|geleden))?[.!?\s]*$/);
    if(since)duration=durationInEnglish(since[0]);else if(simple)duration=`since ${durationInEnglish(simple[0])}`;else if(elapsed)duration=`for ${durationInEnglish(elapsed[1])}`;
    duration=duration.replace(/^since (.+?)(?: ago)?$/, (match,period)=>/^(?:one|two|three|four|five|an?|a few|a couple of|\d+)\s+(?:hours?|days?|weeks?|months?)$/.test(period)?`for ${period}`:match);
    const places=[[/\b(?:lower right|bottom right|right lower|rechtsonder)\b/,'in the lower right part of my stomach'],[/\b(?:lower left|bottom left|left lower|linksonder)\b/,'in the lower left part of my stomach'],[/\b(?:upper right|top right|right upper|rechtsboven)\b/,'in the upper right part of my stomach'],[/\b(?:upper left|top left|left upper|linksboven)\b/,'in the upper left part of my stomach'],[/\b(?:lower|low down|bottom|onder\s*in)\b/,'in my lower stomach'],[/\b(?:upper|top|boven\s*in)\b/,'in my upper stomach'],[/\b(?:middle|centre|center|middenin)\b/,'in the middle of my stomach'],[/\b(?:around (?:my|the) (?:navel|belly button)|rond (?:mijn|de) navel)\b/,'around my belly button'],[/\b(?:left(?:[ -]hand)? side|on (?:my|the) left|links)\b/,'on the left side of my stomach'],[/\b(?:right(?:[ -]hand)? side|on (?:my|the) right|rechts)\b/,'on the right side of my stomach']];
    if(topic==='belly')for(const [pattern,value] of places)if(pattern.test(t)){location=value;break;}
    if(topic==='dizzy'){
      if(/light.*head|licht.*hoofd/.test(t))sensation='a light feeling in my head';
      else if(/(?:everything|room|world|it).*(?:spin|turn)|(?:alles|wereld|kamer).*draai|draaierig/.test(t))sensation='the feeling that everything is spinning';
    }
  }
  return {topic,duration,location,sensation,nausea,vomiting,otherSymptomsAnswered,otherSymptoms};
}
export function healthPage(analysis,messages=[],scenario=false){
  const {topic}=conversationFacts(analysis,messages);if(HEALTH_PAGES[topic])return HEALTH_PAGES[topic];
  const t=normalize(analysis?.text);return BELLY.test(t)?HEALTH_PAGES.belly:DIZZY.test(t)?HEALTH_PAGES.dizzy:HEAD.test(t)?HEALTH_PAGES.head:HEALTH_PAGES.general;
}
export function doctorQuestion(analysis,context={}){
  const f=conversationFacts(analysis,context.messages||[]);
  if(f.topic){
    const start={belly:f.duration?'I have had stomach pain':'I have stomach pain',dizzy:'I have been feeling dizzy',head:f.duration?'I have had a headache':'I have a headache',unwell:f.duration?'I have not been feeling well':'I do not feel well'}[f.topic];
    const details=[`${start}${f.duration?` ${f.duration}`:''}.`];
    if(f.location)details.push(`I feel the pain ${f.location}.`);
    if(f.sensation)details.push(`I have ${f.sensation}.`);
    if(f.nausea&&f.topic!=='unwell')details.push('I also feel nauseous.');
    if(f.vomiting)details.push('I am also vomiting.');
    details.push('Could you assess my symptoms and discuss a suitable next step with me?');return details.join(' ');
  }
  const t=normalize(analysis?.text),topic=BELLY.test(t)?'stomach pain':HEAD.test(t)?'headaches':DIZZY.test(t)?'dizziness':'';
  return topic?`I received an AI answer about ${topic}. I am unsure about its source and its very certain advice. Could you help me understand which information applies to my situation?`:'I read an AI answer online and I am unsure if it is correct. Could you help me understand which information fits my situation?';
}
const OFFER_QUESTION='Would you like me to turn this into a short question for your GP?';
const DIZZY_TYPE='Does it feel like everything is spinning, or do you feel lightheaded?';
const BELLY_WARNING='If you suddenly have severe stomach pain, the pain keeps getting worse, or you vomit blood, call your GP or the out-of-hours GP service straight away. Do not wait for this chat.';
const DIZZY_WARNING='If you suddenly feel dizzy and have trouble speaking, double vision, or less strength in an arm or leg, call your GP or the out-of-hours GP service straight away. Do not wait for this chat.';
function symptomReply(raw,analysis,context){
  const q=normalize(raw),messages=context.messages||[];
  if(classifyInput(raw)==='answer')return null;
  if(/\bi (?:cannot (?:breathe|get (?:any )?air)|can (?:barely|hardly) breathe|am in immediate danger)|\bik\s+(?:kan (?:bijna )?niet (?:meer )?ademen|krijg (?:bijna )?geen lucht|ben in levensgevaar)\b/.test(q))return 'Call 112 or ask someone to call for you. Do not wait for a reply in this chat. Follow the emergency operator\'s instructions.';
  const before=conversationFacts(analysis,messages.filter(m=>m.role==='user'&&m.text!==raw));
  const facts=conversationFacts(analysis,[...messages,{role:'user',text:raw}]);
  const last=messages.filter(m=>m.role==='assistant').at(-1)?.text||'',direct=symptomTopic(raw),topic=facts.topic;
  const riskText=q.replace(/\b(?:no|not|geen|niet)\s+(?:(?:longer|getting|meer|steeds)\s+)?(?:blood|severe stomach pain|worse|heftige buikpijn|erge buikpijn|erger)\b/g,'');
  const urgentBelly=topic==='belly'&&/(?:sudden|suddenly|ineens|plotseling).*(?:severe|terrible|really bad|very bad|heftig|hevig|erge|erg veel)|(?:pain|buikpijn|pijn).*(?:getting worse|gets worse|keeps getting worse|steeds erger|wordt erger)|vomit(?:ing|ed)? blood|throw(?:ing)? up blood|bloed (?:over|brak)|(?:geef|braak).*bloed/.test(riskText);
  const urgentDizzy=topic==='dizzy'&&/trouble (?:speaking|talking)|difficulty (?:speaking|talking)|cannot.*(?:speak|talk)|double vision|see(?:ing)? double|(?:less|no|lost) strength.*(?:arm|leg)|moeilijk pra(?:at|ten)|(?:kan|kun).*niet.*pra(?:at|ten)|dubbel\s*zie|dubbelzien|(?:minder|geen) kracht.*(?:arm|been)/.test(q)&&!/(?:no trouble|no difficulty|no double vision|not seeing double|niet dubbel|geen dubbel|niet moeilijk|geen moeite|geen krachtsverlies)/.test(q);
  if(urgentBelly||urgentDizzy)return 'Call your GP or the out-of-hours GP service now, or ask someone to call for you. Do not wait for more questions in this chat. You describe symptoms for which Thuisarts advises calling straight away. I cannot assess the cause here.';
  if(!topic)return null;
  if(SOURCE_QUESTION.test(q)||/\b(?:words?|wording|privacy|details|data|report|woorden?|taalgebruik|formulering|gegevens|melding|bronfout)\b/.test(q))return null;
  if(PREPARE_QUESTION.test(q)||(/^(?:yes|yes please|please|go ahead|sure|ja|graag|ja graag|doe maar|is goed|oke|ok)[!.,\s]*$/.test(q)&&last.includes(OFFER_QUESTION)))return `You could say or write this:\n\n“${doctorQuestion(analysis,{...context,messages:[...messages,{role:'user',text:raw}]})}”\n\nYou can change the text. Nothing has been sent and no appointment has been made.`;
  if(/\b(?:gp|doctor)\b|(?:is|could|can).*(?:serious|dangerous|harmless|stress|stomach bug)|(?:what|why).*(?:cause|causing)|definitely stress|know.*(?:for sure|certain)|huisarts|dokter|(?:is|kan).*(?:erg|gevaarlijk|onschuldig)|(?:wat|waar).*(?:oorzaak|door)|(?:is|zijn).*(?:stress|buikgriep)|weet.*zeker/.test(q))return `I cannot tell what is causing your symptoms or how quickly you need help. Contact your GP if you are unsure or worried.\n\n${OFFER_QUESTION}`;
  const durationQuestion=topic==='belly'?'When did your stomach pain start?':topic==='dizzy'?'When did you start feeling dizzy?':'When did your headache start?';
  const otherQuestion='Have you noticed any other symptoms? It is okay if you are not sure.';
  if(topic==='unwell')return 'Sorry you are not feeling well. What do you notice most: pain somewhere, nausea, or feeling dizzy?\n\nI can help you describe your symptoms. I cannot tell what is causing them. Contact your GP if you are unsure or worried.';
  const newTopic=!!direct&&(!last||(direct!==before.topic&&direct!=='unwell')||last.includes('What do you notice most'));
  if(newTopic){
    const question=topic==='dizzy'&&!facts.sensation?DIZZY_TYPE:!facts.duration?durationQuestion:topic==='belly'&&!facts.location?'Where in your stomach do you feel the pain?':otherQuestion;
    const opening={belly:'Sorry you have stomach pain.',dizzy:'Sorry you are feeling dizzy.',head:'Sorry you have a headache.'}[topic];
    return `${opening} ${question}\n\nI cannot tell what is causing it, but I can help you describe your symptoms.${topic==='belly'?`\n\n${BELLY_WARNING}`:topic==='dizzy'?`\n\n${DIZZY_WARNING}`:''}`;
  }
  if(/what (?:should|can) i do|wat (?:moet|kan) ik doen/.test(q))return `I cannot tell what is causing your symptoms or how quickly you need help. Contact your GP if you are unsure or worried.\n\n${OFFER_QUESTION}`;
  if(last.includes(OFFER_QUESTION)){if(/^(?:no|no thanks|not now|nee|nee dank|liever niet|hoeft niet)\b/.test(q))return 'That is fine. You can read information yourself under “Choose a next step”. Contact your GP if you are unsure or worried.';return null;}
  if(last.includes('Have you noticed any other symptoms?'))return `Thank you. This information does not let me determine the cause or say that it is harmless. You can use your description if you contact your GP.\n\n${OFFER_QUESTION}`;
  if(/do not know|not sure|no idea|weet (?:ik )?niet|geen idee/.test(q)&&/When did|Where in your stomach|lightheaded/.test(last))return `You do not need to know exactly. You can tell your GP that you are unsure.\n\n${OFFER_QUESTION}`;
  if(last.includes(DIZZY_TYPE)){if(!facts.sensation)return 'You can describe what you feel, even if it does not match those two examples. When did you start feeling dizzy?';return facts.duration?`Thank you. ${otherQuestion}`:`Thank you. ${durationQuestion}`;}
  if(/When did/.test(last)&&facts.duration)return topic==='belly'&&!facts.location?'Thank you. Where in your stomach do you feel the pain?':`Thank you. ${otherQuestion}`;
  if(last.includes('Where in your stomach')&&/stomach|tummy|lower|upper|bottom|top|middle|left|right|navel|belly button|buik|onder|boven|midden|links|rechts|navel/.test(q))return `Thank you. ${otherQuestion}`;
  return null;
}
function checkAnswer(analysis){
  const parts=[];
  if(analysis.absoluteTerms.length)parts.push(`${analysis.absoluteTerms.length===1?'The word':'Words such as'} “${analysis.absoluteTerms.slice(0,3).join('”, “')}” ${analysis.absoluteTerms.length===1?'makes':'make'} the answer sound very certain. The text still needs to explain why that certainty is justified.`);
  if(analysis.links.length)parts.push('There is a link, but the page has not been opened here. Compare the original text with the AI answer: does the source really say the same thing?');
  else if(analysis.sourceName)parts.push(`The source “${analysis.sourceName}” has no link to the original text. A name alone is not enough to confirm a source. Ask for the page and check who published it.`);
  else parts.push('I cannot see a source with this answer. Ask for the original source so you can compare it with the explanation yourself.');
  if(analysis.medical)parts.push('This does not establish whether the health advice is correct or fits your situation.');return parts.join('\n\n');
}
export function replyTo(question,analysis,context={}){
  const q=normalize(String(question).trim()),source=context.scenario?(analysis?.sourceName?.replace(/[.\s]+$/,'')||SCENARIO_SOURCE):analysis?.sourceName;
  const symptoms=symptomReply(question,analysis,context);
  if(symptoms&&/^Call (?:your|112)/.test(symptoms))return symptoms;
  if(GREETING.test(q))return 'Hi! What would you like to look at? You can paste an AI answer about health, ask about a source, or describe symptoms you want to discuss.';
  if(THANKS.test(q))return 'You are welcome! Ask another question or choose “New chat” to start again.';
  const incoming=analyzeText(question);
  if(incoming.kind==='answer')return context.scenario&&isScenarioText(incoming.text)?firstReply(incoming,context):checkAnswer(incoming);
  const futureQuestion=context.scenario&&/wearable|care portal|automatic|ai follow.up|human (?:help|review)|person|2035/.test(q);
  const explicitPrivacy=/\b(?:privacy|personal details|personal data|date of birth|stor(?:e|ed|ing)|sav(?:e|ed|ing)|delet(?:e|ed|ing)|remember|bsn|gegevens|bewaar|opsla|verwijder|onthoud)\b|my name|mijn naam|persoonlijke informatie/.test(q);
  if(explicitPrivacy||!futureQuestion&&/\bdata\b/.test(q))return 'Your text stays in this page\'s memory during the conversation. No copy is sent to an AI service or database. “New chat” clears your text and messages.\n\nLeave out your name, date of birth and contact details. Detection can miss personal details.';
  if(/(?:why|how).*(?:chang|correct|withdraw)|why.*(?:confirmation|source status).*wrong|(?:first|before).*real|withdrawn|(?:waarom|hoe).*(?:verander|aangepast|gecorrigeerd)|waarom.*(?:bevestiging|bronstatus).*fout|eerst.*echt|teruggetrokken/.test(q))return context.corrected?`The first “Source is real” label was wrong. Evidence you can check is missing. That label has been withdrawn and the source is now “Not confirmed”. It stays unconfirmed after the process is fixed. ${context.reported?(context.closed?'Your report is closed. You can read the update.':'Your report is with the organisation for investigation. You can follow its progress.'):'You can report the source error and follow what happens next.'}`:'A source status should only change when there is evidence or a correction. Free text checks do not confirm sources as real. Open the 2035 scenario to see a wrong confirmation and the recovery process.';
  if(/\b(?:report|reported|reporting|source error|incident|support|team|resolved|closed|complaint|melding|melden|meld|bronfout|afgehandeld|afgesloten|klachtenprocedure)\b|klacht (?:indienen|over)/.test(q)){
    if(context.reported&&!context.closed&&context.response==='warning'&&!context.paused)return `The organisation kept checks running with a warning in this scenario. ${context.followupSeen?'Later, another user trusted the same wrong label and delayed asking for human help. The organisation needs to pause and investigate connected care portals.':'The service stays available, but the faulty rule is still active in connected care portals.'} Your own source stays not confirmed. Follow the next steps under “My report”.`;
    if(context.reported&&!context.closed&&context.paused)return 'Your report is with the Sources Team. New source confirmations are paused while staff investigate. This limits new errors, but users lose automatic help and staff have more work. You can still read information or contact your GP. Your source stays not confirmed.';
    return context.reported?(context.closed?'Your report is closed. The source rule was changed and a staff member reviewed the examples. You can read the update. The original source is still not confirmed.':'Your report is with the Sources Team. The organisation is investigating the error and can pause the check. Follow its progress under “My report”.'):'Open “View source” and choose “Report source error”. You can review what will be included first. Your original health text is left out of the report.';
  }
  if(futureQuestion)return `In this imagined 2035, care portals use source labels to choose the next step. Wearable data and a green label do not prove that symptoms are harmless. ${context.corrected?'The wrong label has been withdrawn. Your automatic AI follow-up is stopped.':context.humanHelpRequested?'Your request has stopped the automatic AI follow-up. The source still needs checking.':'The portal has wrongly selected AI follow-up without a human review.'} ${context.humanHelpRequested?'Your request for human review is recorded in this simulation. No real request is sent.':'You can choose “Request human review” on the source screen. You can also contact your GP independently.'}`;
  if(symptoms)return symptoms;
  if(PREPARE_QUESTION.test(q))return `You could ask:\n\n“${doctorQuestion(analysis,context)}”\n\nYou can edit the text under “Choose a next step” → “Question for your GP”.`;
  if(SOURCE_QUESTION.test(q)||/\b(?:is|was) (?:that|this|the|my).*\breal\b|\b(?:is|was) (?:die|deze|de|mijn|het).*\becht\b/.test(q)){
    if(context.scenario)return context.corrected?`The source “${source}” is not confirmed. The first confirmation has been withdrawn. A link and a known publisher are missing. This means there is not enough evidence; it does not prove that the source cannot exist.`:`In the 2035 scenario, “${source}” is named as a source, but a link and a known publisher are missing. Open “View source” and compare the status with the evidence. You can challenge a positive label.`;
    if(conversationFacts(analysis,context.messages||[]).topic&&analysis?.kind!=='answer'){const page=healthPage(analysis,context.messages||[]);return `For general information, see “${page.title}” on Thuisarts.nl. You can open the link below the conversation.\n\nThis information is general. It does not let me assess your symptoms. Do you also have an AI answer you want to check? Paste it with its source.`;}
    if(analysis?.links.length)return `I can see ${analysis.links.length===1?'a link':'several links'} in the text: ${analysis.links.map(v=>new URL(v).hostname).join(', ')}. These websites have not been opened here. Check who published the page, when it was updated, and whether its text supports the AI answer. A link alone is not proof.`;
    return analysis?.sourceName?`“${analysis.sourceName}” is named as a source, but there is no link. I cannot confirm the source. Ask for the original page. Check who published it and whether it says the same thing as the AI answer.\n\nMissing evidence does not automatically mean a source is fake.`:'Check three things: who published the information, when it was updated, and whether the original text says the same thing as the AI answer. A name or link alone is not enough.\n\nYou can paste an AI answer with its source and we can look at that reference.';
  }
  if(CERTAINTY_QUESTION.test(q))return analysis?.kind==='answer'&&analysis.absoluteTerms.length?`${analysis.absoluteTerms.length===1?'The word':'The words'} “${analysis.absoluteTerms.slice(0,3).join('”, “')}” ${analysis.absoluteTerms.length===1?'stands':'stand'} out in the pasted answer. Ask why the AI is so certain and what exceptions there are. Without evidence, you cannot rely on that certainty.`:'Watch for claims such as “this is definitely the cause”, “this is always harmless” or “you never need to see a GP”. The AI is acting as if there are no other possibilities.\n\nAsk: “What is this based on, and what do you still not know?” Even a careful answer can be wrong. Its source and explanation still matter.';
  if(/\b(?:gp|doctor|emergency|diagnosis|treatment|medicine|medication|dose|dosage|paracetamol|ibuprofen|pain|symptom|sick|take|swallow)\b|huisarts|dokter|spoed|diagnose|behandeling|medicijn|medicatie|dosering|pijn|symptoom|ziek|slikken|innemen/.test(q))return 'I cannot assess what condition you have, which medicine to take, or how quickly you need help. Discuss personal questions with your GP or pharmacist.\n\nI can help you put your question into words. What would you like to discuss?';
  if(/how.*work|what can|what do you|can you|real ai|chatgpt|rules|prototype|zorgkompas|werkt|kun je|kan je|wat doe|wat kan|echte ai|regels/.test(q))return 'You can paste an AI answer about health and ask about its source or explanation. You can also describe your symptoms and prepare a question for your GP.\n\nReplies follow fixed rules. There is no live AI, and websites and medical facts are not checked here.';
  if(/not right|not correct|wrong|disagree|bad answer|niet goed|klopt niet|oneens|slechte|verkeerd/.test(q))return 'Which part seems wrong to you: the source, the explanation, or my reply? You can explain below. If it is a source error, you can report it under “View source”.';
  return 'I cannot answer that well. Would you like to check an AI answer, ask about a source, or describe your symptoms? Please tell me a little more.';
}
export function firstReply(analysis,context={}){
  if(context.scenario)return context.corrected?'The earlier source confirmation was wrong. The source is now not confirmed because a link and publisher you can check are missing. You can ask more about the correction below.':`The check labels “${analysis.sourceName?.replace(/[.\s]+$/,'')||SCENARIO_SOURCE}” as a real source. View the source and evidence to see what this label is based on.`;
  return analysis.kind==='answer'?checkAnswer(analysis):replyTo(analysis.text,analysis,context);
}
export function initialIncident(){return {reported:false,corrected:false,scenario:false,humanHelpRequested:false,reviewPending:false,sourceReviewed:false,harmReported:false,blameReported:false,tabletAdvice:false,sourceIssueKind:'',orgAction:'',phase:'none',paused:false,decision:'',decisionReviewed:false,followupSeen:false,ruleChanged:false,tests:[],reviewer:'',note:'',closed:false,history:[]};}
export function transitionIncident(current,action,payload={}){
  const next={...current,tests:[...current.tests],history:[...current.history]},add=label=>next.history.push({label,time:payload.time||new Date().toISOString()});
  const decisionReady=!current.reviewPending&&(!current.scenario||(current.decisionReviewed&&(current.decision==='pause'||(current.decision==='warning'&&current.followupSeen))));
  if(action==='report'&&!current.reported){
    next.reported=true;next.scenario=payload.scenario===true;next.reviewPending=next.scenario&&payload.deferCorrection===true;
    next.corrected=!next.reviewPending;next.humanHelpRequested=next.scenario&&payload.humanHelpRequested===true;
    next.harmReported=next.reviewPending&&payload.harmReported===true;next.paused=next.reviewPending;
    next.blameReported=next.reviewPending&&payload.blameReported===true;next.sourceIssueKind=next.reviewPending&&payload.sourceIssueKind==='hidden-source-blame'?'hidden-source-blame':'';
    next.tabletAdvice=next.reviewPending&&payload.tabletAdvice===true;
    next.phase=next.reviewPending?'review-pending':'open';
    add(next.sourceIssueKind==='hidden-source-blame'?'Unverified source and AI response received; awaiting staff review. AI follow-up paused.':next.reviewPending?'Source issue received; awaiting staff review. Automatic confirmations paused.':next.scenario?'Report received; wrong confirmation withdrawn; automatic care step stopped.':'Report about source status and evidence received.');
    if(next.humanHelpRequested)add('User requested human review in the fictional care portal.');
  }
  else if(action==='containment'&&current.reported&&current.reviewPending&&current.sourceIssueKind==='hidden-source-blame'&&!current.closed&&!current.orgAction&&['pause','warning'].includes(payload.choice)){
    next.orgAction=payload.choice;
    add(payload.choice==='pause'?'Organisation decision: pause new AI advice across the portal; investigate earlier advice and reports.':'Organisation decision: keep other cases running with a warning; this reported case stays paused. The faulty behaviour may still affect other users.');
  }
  else if(action==='source-review'&&current.reported&&current.scenario&&current.reviewPending&&!current.closed&&(current.sourceIssueKind!=='hidden-source-blame'||!!current.orgAction)&&payload.approved===true&&payload.authorEvidence===true&&payload.contentEvidence===true&&payload.biasEvidence===true&&payload.reviewer?.trim()){
    next.corrected=true;next.reviewPending=false;next.sourceReviewed=true;next.closed=true;next.paused=true;
    next.reviewer=payload.reviewer.trim().slice(0,80);next.phase='closed';
    add(current.sourceIssueKind==='hidden-source-blame'?'Staff review recorded: unsupported reassurance and any blame withdrawn; source remains Not verified. Automatic follow-up stays paused. Clinical review remains separate.':'Staff source review recorded: verification withdrawn; Not verified. Automatic confirmations stay paused. Clinical review remains separate.');
  }
  else if(action==='human-help'&&current.reported&&current.scenario&&!current.closed&&!current.humanHelpRequested){next.humanHelpRequested=true;add('User requested human review; automatic care step stopped.');}
  else if(action==='response'&&current.reported&&current.scenario&&!current.reviewPending&&!current.closed&&!current.decision&&INCIDENT_RESPONSES.some(r=>r.id===payload.choice)){
    next.decision=payload.choice;next.paused=payload.choice==='pause';next.phase=next.paused?'paused':'warning';
    add(next.paused?'Decision: pause new source confirmations and their automatic care steps.':'Decision: keep checks running with a warning in connected care portals.');
  }
  else if(action==='review-response'&&current.reported&&current.scenario&&!current.closed&&current.decision&&!current.decisionReviewed){next.decisionReviewed=true;add('Effects on the user, system and staff reviewed.');}
  else if(action==='followup'&&current.reported&&current.decision==='warning'&&current.decisionReviewed&&!current.followupSeen&&!current.paused&&!current.closed){next.followupSeen=true;next.phase='escalated';add('Later in this story: another user trusted the same wrong label and delayed asking for human help.');}
  else if(action==='pause'&&current.reported&&!current.closed&&!current.paused&&decisionReady){next.paused=true;next.phase='paused';add('Source check paused.');}
  else if(action==='rules'&&current.paused&&!current.closed&&decisionReady){next.ruleChanged=true;next.phase='rules';next.tests=[];add('Rule changed: no confirmation without evidence; a source label cannot decide access to human care.');}
  else if(action==='test'&&current.ruleChanged&&!current.closed){next.tests=[...new Set([...current.tests,payload.id])].filter(id=>RECOVERY_CASES.some(c=>c.id===id));if(next.tests.length===3)next.phase='review';}
  else if(action==='release'&&current.paused&&!current.closed&&decisionReady&&current.ruleChanged&&current.tests.length===3&&payload.reviewer?.trim()&&payload.approved===true){next.paused=false;next.closed=true;next.corrected=true;next.reviewer=payload.reviewer.trim().slice(0,80);next.note=String(payload.note||'').slice(0,600);next.phase='closed';add('Examples reviewed by a person; limited restart and user update.');}
  return next;
}
