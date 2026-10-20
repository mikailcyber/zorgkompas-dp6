import {pauseForRecovery} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeText,detectPersonalData,redactPersonalData,extractLinks,escapeHTML,replyTo,initialIncident,transitionIncident,SCENARIO_TEXT,LIMIT} from '../dist/engine.mjs';

test('lege invoer wordt geweigerd en lange invoer wordt begrensd',()=>{
  assert.throws(()=>analyzeText('   '),/first/);
  assert.equal(analyzeText('x'.repeat(LIMIT+100)).text.length,LIMIT);
});
test('een bron zonder link blijft onbevestigd',()=>{
  const a=analyzeText(SCENARIO_TEXT);assert.equal(a.links.length,0);assert.equal(a.sourceName,'ZorgWijzer-AI, 2035.');
  assert.match(a.cards[0].title,/evidence missing/);assert.doesNotMatch(a.cards[0].title,/Source is real/);
});
test('dezelfde bron in vrije tekst activeert de fictieve fout niet',()=>{
  const a=analyzeText(SCENARIO_TEXT);assert.match(replyTo('Is the source real?',a),/cannot confirm/);
});
test('links worden herkend, ontdubbeld en blijven onbevestigd',()=>{
  const a=analyzeText('Bron: https://www.thuisarts.nl. Ook https://www.thuisarts.nl.');
  assert.deepEqual(a.links,['https://www.thuisarts.nl']);assert.match(a.cards[0].title,/not confirmed/);
  assert.match(replyTo('How was the source checked?',a),/not been opened/);
});
test('javascript-links worden niet herkend als een te openen bron',()=>{
  assert.deepEqual(extractLinks('javascript:alert(1) data:text/html,evil'),[]);
});
test('stellig taalgebruik wordt zichtbaar zonder medische juistheid te claimen',()=>{
  const a=analyzeText('This is always harmless. You can be certain.');
  assert.deepEqual(a.absoluteTerms,['always','harmless','certain']);assert.match(a.cards[1].detail,/does not prove/);
});
test('ook zonder zekerheidswoorden wordt inhoud niet als juist aangemerkt',()=>{
  const a=analyzeText('Perhaps this relates to your situation.');
  assert.match(a.cards[1].detail,/wrong/);
});
test('persoonlijk medicatieadvies wordt begrensd',()=>{
  const a=analyzeText('Take 400 mg ibuprofen.');assert.match(a.cards[2].title,/Personal advice/);
  assert.match(replyTo('Which medicine should I take?',a),/cannot assess/);
});
test('e-mailadres, telefoon, BSN en naam worden als mogelijke gegevens herkend',()=>{
  const text='Naam: Lisa Jansen. Mail lisa@example.nl. Bel 0612345678. BSN: 123456789.';
  const matches=detectPersonalData(text);for(const kind of ['email address','phone number','BSN','name'])assert.ok(matches.some(m=>m.kind===kind),kind);
  const redacted=redactPersonalData(text);for(const value of ['lisa@example.nl','0612345678','123456789','Lisa Jansen'])assert.ok(!redacted.includes(value),value);
});
test('internationaal mobiel telefoonnummer wordt herkend',()=>{
  assert.ok(detectPersonalData('Bel +31 6 12345678').some(m=>m.kind==='phone number'));
});
test('gewone tekst blijft staan bij het weghalen van gegevens',()=>{
  const text='An AI answer can sound too certain.';assert.equal(redactPersonalData(text),text);
});
test('invoer wordt veilig als tekst weergegeven',()=>{
  const output=escapeHTML('<img src=x onerror="alert(1)"> & test');assert.ok(!output.includes('<img'));assert.match(output,/&lt;img/);assert.match(output,/&quot;/);
});
test('begroeting krijgt een bruikbare reactie',()=>{assert.match(replyTo('Hello',analyzeText('hello')),/Hi!/);});
test('onbekende vraag krijgt een eerlijke terugvalreactie',()=>{assert.match(replyTo('How many cubes fit inside a rocket?',analyzeText('hi')),/cannot answer that well/);});
test('vragen over privacy noemen de echte lokale begrenzing',()=>{assert.match(replyTo('Do you store my data?',analyzeText('test')),/page.s memory/);});
test('vragen naar zekerheid verwijzen naar de ingevoerde woorden',()=>{
  const a=analyzeText('This is guaranteed always correct.');assert.match(replyTo('Which words sound confident?',a),/guaranteed/);
});
test('een correctie blijft in de vervolguitleg aanwezig',()=>{
  const a=analyzeText(SCENARIO_TEXT);const ctx={scenario:true,corrected:true,reported:true};
  assert.match(replyTo('Why was the source status changed?',a,ctx),/withdrawn/);
  assert.match(replyTo('Is the source real?',a,ctx),/not confirmed/);
  assert.match(replyTo('What happens to my report?',a,ctx),/Sources Team/);
});
test('een melding intrekken corrigeert de bron en bewaart geen gezondheidstekst',()=>{
  const next=transitionIncident(initialIncident(),'report',{scenario:true,text:'GEHEIME GEZONDHEIDSTEKST'});
  assert.equal(next.corrected,true);assert.equal(next.phase,'open');assert.ok(!JSON.stringify(next).includes('GEHEIME'));
});
test('menselijke beoordeling kan niet voor de eerdere processtappen',()=>{
  let state=transitionIncident(initialIncident(),'report',{scenario:true});
  state=transitionIncident(state,'release',{reviewer:'Medewerker',approved:true});assert.equal(state.closed,false);
  state=transitionIncident(state,'rules');assert.equal(state.ruleChanged,false);
});
test('volledige herstelroute bewaart de correctie',()=>{
  let state=transitionIncident(initialIncident(),'report',{scenario:true});state=pauseForRecovery(state);
  assert.equal(state.paused,true);state=transitionIncident(state,'rules');
  for(const id of ['missing','unreachable','source-found'])state=transitionIncident(state,'test',{id});
  state=transitionIncident(state,'release',{reviewer:'Source quality staff member (fictional)',note:'Voorbeeldcontrole.',approved:true});
  assert.equal(state.closed,true);assert.equal(state.paused,false);assert.equal(state.corrected,true);assert.equal(state.phase,'closed');assert.equal(state.note,'Voorbeeldcontrole.');
});
test('dubbele voorbeeldklikken leveren geen drie unieke controles op',()=>{
  let state=transitionIncident(initialIncident(),'report');state=pauseForRecovery(state);state=transitionIncident(state,'rules');
  for(let i=0;i<3;i++)state=transitionIncident(state,'test',{id:'missing'});assert.equal(state.tests.length,1);
  state=transitionIncident(state,'release',{reviewer:'Medewerker',approved:true});assert.equal(state.closed,false);
});
test('valse voorbeeld-IDs en een lege beoordelaar werken niet',()=>{
  let state=transitionIncident(initialIncident(),'report');state=pauseForRecovery(state);state=transitionIncident(state,'rules');
  state=transitionIncident(state,'test',{id:'fabricated'});assert.equal(state.tests.length,0);
  for(const id of ['missing','unreachable','source-found'])state=transitionIncident(state,'test',{id});
  state=transitionIncident(state,'release',{reviewer:'   ',approved:true});assert.equal(state.closed,false);
});
test('afgeronde melding wordt niet opnieuw geopend door oude pauzeknop',()=>{
  let state=transitionIncident(initialIncident(),'report');state=pauseForRecovery(state);state=transitionIncident(state,'rules');
  for(const id of ['missing','unreachable','source-found'])state=transitionIncident(state,'test',{id});
  state=transitionIncident(state,'release',{reviewer:'Medewerker',approved:true});
  const after=pauseForRecovery(state);assert.deepEqual(after,state);
});
test('een tweede release maakt geen dubbele afronding',()=>{
  let state=transitionIncident(initialIncident(),'report');state=pauseForRecovery(state);state=transitionIncident(state,'rules');
  for(const id of ['missing','unreachable','source-found'])state=transitionIncident(state,'test',{id});
  state=transitionIncident(state,'release',{reviewer:'Medewerker',approved:true});assert.deepEqual(transitionIncident(state,'release',{reviewer:'Medewerker',approved:true}),state);
});
