import {pauseForRecovery} from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderUI,ROUTES,dialogMarkup} from '../dist/ui.mjs';
import {createState,guardedRoute} from '../dist/app.mjs';
import {analyzeText,SCENARIO_TEXT,transitionIncident} from '../dist/engine.mjs';

const prepared=()=>{const s=createState();s.privacyAcknowledged=true;s.analysis=analyzeText(SCENARIO_TEXT);s.input=SCENARIO_TEXT;s.draft=SCENARIO_TEXT;return s;};
const completed=()=>{const s=prepared();s.scenario=true;s.presentation=true;s.currentReported=true;s.incident=transitionIncident(s.incident,'report',{scenario:true});s.incident=pauseForRecovery(s.incident);s.incident=transitionIncident(s.incident,'rules');for(const id of ['missing','unreachable','source-found'])s.incident=transitionIncident(s.incident,'test',{id});s.incident=transitionIncident(s.incident,'release',{reviewer:'Medewerker (fictief)',approved:true});return s;};

test('elk scherm kan renderen en heeft één hoofdkop en één main',()=>{
  for(const page of ROUTES){const s=completed();s.page=page;const html=renderUI(s);assert.equal((html.match(/<h1\b/g)||[]).length,1,page);assert.equal((html.match(/<main\b/g)||[]).length,1,page);assert.ok(!html.includes('undefined'),page);}
});
test('alle navigatiebestemmingen bestaan',()=>{
  for(const page of ROUTES){const s=completed();s.page=page;for(const m of renderUI(s).matchAll(/data-to="([^"]+)"/g))assert.ok(ROUTES.includes(m[1]),page+' → '+m[1]);}
});
test('directe resultaat- en organisatielinks krijgen een bruikbare terugvalroute',()=>{
  const s=createState();for(const page of ['checking','result','source','chat','received'])assert.equal(guardedRoute(page,s),'home');
  assert.equal(guardedRoute('org-review',s),'org');assert.equal(guardedRoute('ticket',s),'scenario');
});
test('menselijke beoordeling is niet via een directe route over te slaan',()=>{
  const s=prepared();s.incident=transitionIncident(s.incident,'report');s.incident=pauseForRecovery(s.incident);s.incident=transitionIncident(s.incident,'rules');
  assert.equal(guardedRoute('org-review',s),'org-tests');
});
test('vrije tekst krijgt geen positieve bronstatus',()=>{
  const s=prepared();s.page='result';let html=renderUI(s);assert.ok(!html.includes('<h1 tabindex="-1">Source is real</h1>'));assert.match(html,/cannot confirm|not confirmed|Not confirmed|missing/);
  s.page='source';html=renderUI(s);assert.match(html,/Not confirmed/);assert.ok(!html.includes('class="status-dot"></span>Source is real'));
});
test('het fictieve scenario toont eerst de gekozen systeemfout',()=>{
  const s=prepared();s.scenario=true;s.presentation=true;s.page='result';assert.match(renderUI(s),/<h1 tabindex="-1">Source is real/);
});
test('na een melding krijgen resultaat, bron en chat nooit het oude positieve label terug',()=>{
  const s=prepared();s.scenario=true;s.presentation=true;s.currentReported=true;s.incident=transitionIncident(s.incident,'report',{scenario:true});
  for(const page of ['result','source','chat']){s.page=page;const html=renderUI(s);assert.ok(!html.includes('<h1 tabindex="-1">Source is real'),page);assert.ok(!html.includes('class="status-dot"></span>Source is real'),page);assert.match(html,/not confirmed|Not confirmed/,page);}
});
test('afhandeling bevestigt de oorspronkelijke bron niet',()=>{
  const s=completed();s.page='update';assert.match(renderUI(s),/still not confirmed/);s.page='source';assert.match(renderUI(s),/Not confirmed/);
});
test('de organisatie krijgt de oorspronkelijke gezondheidstekst niet',()=>{
  const s=completed();s.input='PRIVE GEZONDHEIDSTEKST';s.analysis=analyzeText(s.input);
  for(const page of ROUTES.filter(p=>p.startsWith('org'))){s.page=page;assert.ok(!renderUI(s).includes('PRIVE GEZONDHEIDSTEKST'),page);}
});
test('schadelijke HTML in een vraag of bron wordt als tekst weergegeven',()=>{
  const s=prepared();s.analysis=analyzeText('Bron: <img src=x onerror=alert(1)>');s.page='source';assert.ok(!renderUI(s).includes('<img src=x'));assert.match(renderUI(s),/&lt;img/);
  s.page='chat';s.messages=[{role:'user',text:'<script>alert(1)</script>'}];assert.ok(!renderUI(s).includes('<script>alert'));assert.match(renderUI(s),/&lt;script/);
});
test('invoer heeft een toegankelijk label, limiet, korte privacytekst en foutverwijzing',()=>{
  const s=createState();const html=renderUI(s);assert.match(html,/for="main-input"/);assert.match(html,/maxlength="6000"/);assert.match(html,/Leave out your name and other personal details/);assert.match(html,/aria-describedby="input-hint input-error"/);
});
test('het toekomstvoorbeeld wordt vóór controle als fictief aangeduid',()=>{
  const s=prepared();s.scenario=true;s.presentation=true;s.page='home';assert.match(renderUI(s),/Fictional example with deliberately wrong advice/);
});
test('dialoogvensters hebben een benoemde kop en een sluitknop',()=>{
  const s=prepared();for(const kind of ['privacy','clear','redact','pause','fallback']){const html=dialogMarkup(kind,s,'test');assert.match(html,/id="modal-title"/);assert.match(html,/aria-label="Close window"/);}
});
test('een lege organisatie doet niet alsof er al een klacht binnen is',()=>{const s=createState();s.page='org';assert.match(renderUI(s),/no open reports/);});
test('de startpagina houdt één invoer en maakt het toekomstscenario vindbaar',()=>{
  const html=renderUI(createState());
  assert.equal((html.match(/type="submit"/g)||[]).length,1);
  assert.ok(!html.includes('data-action="privacy"'));
  assert.ok(!html.includes('data-action="example"'));
  assert.ok(!html.includes('data-action="paste"'));
  assert.ok(!html.includes('data-to="about"'));
  assert.equal((html.match(/href="#scenario"/g)||[]).length,1);
  assert.match(html,/Future scenario 2035/);
  assert.ok(!html.includes('Probeer een voorbeeld'));
  assert.ok(!html.includes('class="steps"'));
});
test('de reactie en vervolginvoer staan direct op hetzelfde scherm',()=>{
  const s=prepared();s.page='result';const html=renderUI(s);
  assert.match(html,/id="chat-messages"/);assert.match(html,/id="chat-form"/);assert.match(html,/id="chat-input"/);
  assert.ok(!html.includes('class="side-card"'));assert.ok(!html.includes('class="suggestions"'));assert.ok(!html.includes('class="chat-sidebar'));
  assert.ok(!html.includes('data-to="chat"'));
});
