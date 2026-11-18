(function(){
const $ = s => document.querySelector(s);
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
const CFG_KEY = 'enigma-navidad-config';
const DEMO = {
  title: 'Christmas crackers maze',
  stations: [
    {name:'El acertijo de la cocina', answer:'nevera'},
    {name:'El mensaje del espejo', answer:'espejo'},
    {name:'La foto misteriosa', answer:'sofá'},
    {name:'El código secreto', answer:'árbol'}
  ],
  digits: '2512'
};
const FAILS = ['Frío, frío…','Ni el Grinch se lo cree. Probad otra vez.','Casi… o no. Otra vez.','Los renos dicen que no.','Mmm, no. Volved a leer la pista.','Esa no es. ¡Pensad en equipo!'];

function norm(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()
    .replace(/^(?:(?:el|la|los|las|els|les|un|una|unos|unas)\s+|l['’]\s*)/,'')
    .replace(/[^a-z0-9]/g,'');
}
// Hash: SHA-256 si está disponible; si no, alternativa sencilla
function cyrb53(str, seed){
  let h1=0xdeadbeef^seed, h2=0x41c6ce57^seed;
  for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(16).padStart(14,'0');
}
async function sha(s){
  try{
    if(window.crypto && crypto.subtle){
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
    }
  }catch(e){}
  return [1,2,3,4,5].map(k=>cyrb53(s,k)).join('');
}
function randHex(n){
  const a = new Uint8Array(n);
  try{ crypto.getRandomValues(a); }catch(e){ for(let i=0;i<n;i++) a[i]=Math.random()*256|0; }
  return [...a].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function shuffle(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
async function buildConfig(title, stations, digits, demo){
  const salt = randHex(8);
  const norms = stations.map(s=>norm(s.answer));
  const h = [];
  for(let i=0;i<norms.length;i++) h.push((await sha(salt+'|'+i+'|'+norms[i])).slice(0,24));
  const key = await sha(salt+'|key|'+norms.join('|'));
  const ds = digits.split('').map(Number);
  let mixed = shuffle(ds);
  for(let t=0;t<20 && mixed.join('')===ds.join('') && new Set(ds).size>1;t++) mixed = shuffle(ds);
  const e = mixed.map((d,j)=>(d + parseInt(key.substr(j*2,2),16)) % 10);
  return {v:1, title, salt, names:stations.map(s=>s.name), h, e, demo:!!demo};
}
async function revealDigits(cfg, norms){
  const key = await sha(cfg.salt+'|key|'+norms.join('|'));
  return cfg.e.map((x,j)=>((x - parseInt(key.substr(j*2,2),16)) % 10 + 10) % 10);
}
function encode(cfg){ return btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))); }
function decode(code){
  const c = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if(!c || c.v!==1 || !Array.isArray(c.h) || !Array.isArray(c.e) || !c.salt) throw new Error('bad');
  return c;
}

let cfg = null, solved = [];
const progKey = () => 'enigma-navidad-progreso-'+cfg.salt;
function saveProgress(){ store.set(progKey(), JSON.stringify(solved)); }
function loadProgress(){
  try{ const p = JSON.parse(store.get(progKey())||'null'); if(Array.isArray(p) && p.length===cfg.h.length) return p; }catch(e){}
  return cfg.h.map(()=>null);
}

function render(){
  $('#title').textContent = cfg.title || 'Christmas crackers maze';
  document.title = (cfg.title || 'Christmas crackers maze') + ' · Verificador';
  const lights = $('#lights'); lights.innerHTML='';
  cfg.h.forEach((_,i)=>{ const b=document.createElement('span'); b.className='bulb'+(solved[i]?' on':''); lights.appendChild(b); });

  const active = solved.findIndex(s=>!s);
  const wrap = $('#stations'); wrap.innerHTML='';
  cfg.names.forEach((name,i)=>{
    const card = document.createElement('div');
    const st = solved[i] ? 'solved' : (i===active ? 'active' : 'locked');
    card.className = 'card '+st;
    const num = document.createElement('div'); num.className='num'; num.textContent = solved[i] ? '✓' : (i+1);
    const body = document.createElement('div');
    const nm = document.createElement('div'); nm.className='name'; nm.textContent = name || ('Prueba '+(i+1));
    body.appendChild(nm);
    if(st==='solved'){
      const s=document.createElement('div'); s.className='state'; s.textContent='Resuelta: '+solved[i].raw; body.appendChild(s);
    } else if(st==='locked'){
      const s=document.createElement('div'); s.className='state'; s.textContent='🔒 Se desbloquea al resolver la anterior'; body.appendChild(s);
    } else {
      const f=document.createElement('form'); f.className='form'; f.autocomplete='off';
      const inp=document.createElement('input'); inp.className='answer'; inp.placeholder='Vuestra respuesta…'; inp.setAttribute('aria-label','Respuesta de la prueba '+(i+1));
      inp.spellcheck=false; inp.setAttribute('autocapitalize','off');
      const btn=document.createElement('button'); btn.className='btn'; btn.type='submit'; btn.textContent='Comprobar';
      const msg=document.createElement('div'); msg.className='msg'; msg.setAttribute('aria-live','polite');
      f.append(inp,btn); body.append(f,msg);
      f.addEventListener('submit', async ev=>{
        ev.preventDefault();
        const n = norm(inp.value);
        if(!n){ msg.className='msg'; msg.textContent='Escribid algo primero 🙂'; return; }
        const h = (await sha(cfg.salt+'|'+i+'|'+n)).slice(0,24);
        if(h===cfg.h[i]){
          solved[i] = {n, raw: inp.value.trim()};
          saveProgress(); render();
          const next = document.querySelector('.card.active .answer'); if(next) next.focus();
          if(solved.every(Boolean)) showFinal(true);
        } else {
          msg.className='msg err'; msg.textContent = FAILS[Math.floor(Math.random()*FAILS.length)];
          card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
          inp.select();
        }
      });
      setTimeout(()=>inp.focus(),0);
    }
    card.append(num, body);
    wrap.appendChild(card);
  });

  const demo = $('#demo');
  demo.hidden=true;

  if(solved.every(Boolean)) showFinal(false); else { $('#final').hidden=true; $('#final').innerHTML=''; }
}

function perms(ds){
  const f = n => n<=1 ? 1 : n*f(n-1);
  const counts = {}; ds.forEach(d=>counts[d]=(counts[d]||0)+1);
  return Object.values(counts).reduce((acc,c)=>acc/f(c), f(ds.length));
}
async function showFinal(scroll){
  const ds = await revealDigits(cfg, solved.map(s=>s.n));
  const fin = $('#final'); fin.hidden=false; fin.innerHTML='';
  const h2=document.createElement('h2'); h2.textContent='¡Lo habéis conseguido!';
  const p1=document.createElement('p'); p1.textContent='Estos son los números del candado… pero no están en orden.';
  const tiles=document.createElement('div'); tiles.className='tiles';
  ds.forEach((d,k)=>{ const t=document.createElement('div'); t.className='tile'; t.style.animationDelay=(0.35+k*0.35)+'s'; t.textContent=d; tiles.appendChild(t); });
  const n = perms(ds);
  const p2=document.createElement('p'); p2.textContent = n>1 ? ('Hay '+n+' combinaciones posibles. Usad la última pista… o la paciencia.') : 'Solo hay una combinación posible. ¡A abrir!';
  fin.append(h2,p1,tiles,p2);
  if(scroll) fin.scrollIntoView({behavior:'smooth', block:'center'});
}

/* ---------- Configuración ---------- */
const modal = $('#modal');
function addRow(name, answer){
  const rows = $('#rows');
  const r = document.createElement('div'); r.className='row';
  r.innerHTML = '<span class="i"></span><input class="rn" maxlength="60" placeholder="p. ej. El espejo"><input class="ra" maxlength="60" placeholder="p. ej. espejo"><button type="button" class="x" aria-label="Quitar prueba">×</button>';
  r.querySelector('.rn').value = name||''; r.querySelector('.ra').value = answer||'';
  r.querySelector('.x').addEventListener('click',()=>{ r.remove(); renumber(); });
  rows.appendChild(r); renumber();
}
function renumber(){ document.querySelectorAll('#rows .row .i').forEach((s,i)=>s.textContent=i+1); }
function openPanel(){
  $('#perr').textContent=''; $('#pok').textContent='';
  $('#cTitle').value = cfg.title || '';
  $('#rows').innerHTML='';
  if(cfg.demo) DEMO.stations.forEach(s=>addRow(s.name,s.answer));
  else cfg.names.forEach(n=>addRow(n,''));
  $('#cDigits').value = cfg.demo ? DEMO.digits : '';
  $('#code').value = cfg.demo ? '' : encode(cfg);
  modal.classList.add('open');
  $('#cTitle').focus();
}
function closePanel(){ modal.classList.remove('open'); const a=document.querySelector('.card.active .answer'); if(a) a.focus(); }
$('#gear').addEventListener('click', openPanel);
$('#close').addEventListener('click', closePanel);
modal.addEventListener('click', e=>{ if(e.target===modal) closePanel(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && modal.classList.contains('open')) closePanel(); });
$('#addRow').addEventListener('click', ()=>{ addRow('',''); const l=document.querySelectorAll('#rows .rn'); l[l.length-1].focus(); });

$('#save').addEventListener('click', async ()=>{
  const err = $('#perr'); err.textContent=''; $('#pok').textContent='';
  const rows = [...document.querySelectorAll('#rows .row')].map(r=>({name:r.querySelector('.rn').value.trim(), answer:r.querySelector('.ra').value.trim()}));
  if(!rows.length){ err.textContent='Añade al menos una prueba.'; return; }
  const bad = rows.findIndex(r=>!norm(r.answer));
  if(bad>-1){ err.textContent='Falta la respuesta de la prueba '+(bad+1)+' (las respuestas guardadas no se pueden mostrar: vuelve a escribirlas).'; return; }
  const digits = $('#cDigits').value.replace(/\s/g,'');
  if(!/^\d{2,8}$/.test(digits)){ err.textContent='La combinación debe tener solo números (entre 2 y 8).'; return; }
  cfg = await buildConfig($('#cTitle').value.trim() || 'Christmas crackers maze', rows, digits, false);
  store.set(CFG_KEY, encode(cfg));
  solved = cfg.h.map(()=>null); saveProgress();
  $('#code').value = encode(cfg);
  $('#pok').textContent = 'Partida guardada. Copia el código de abajo y guárdalo por si acaso.';
  render();
});
$('#copy').addEventListener('click', async ()=>{
  const ta=$('#code');
  try{ await navigator.clipboard.writeText(ta.value); $('#pok').textContent='Código copiado.'; }
  catch(e){ ta.focus(); ta.select(); $('#pok').textContent='Selecciónalo y cópialo con Ctrl+C / Cmd+C.'; }
});
$('#load').addEventListener('click', ()=>{
  $('#perr').textContent=''; $('#pok').textContent='';
  try{
    cfg = decode($('#code').value);
    store.set(CFG_KEY, encode(cfg));
    solved = loadProgress();
    render(); $('#pok').textContent='Partida cargada.';
    $('#cTitle').value=cfg.title||''; $('#rows').innerHTML=''; cfg.names.forEach(n=>addRow(n,''));
  }catch(e){ $('#perr').textContent='Ese código no es válido.'; }
});
$('#reset').addEventListener('click', ()=>{
  solved = cfg.h.map(()=>null); saveProgress(); render();
  $('#pok').textContent='Progreso reiniciado: todas las pruebas vuelven a estar sin resolver.';
});

/* ---------- Arranque ---------- */
(async function init(){
  const saved = store.get(CFG_KEY);
  if(saved){ try{ cfg = decode(saved); }catch(e){ cfg=null; } }
  if(!cfg) cfg = await buildConfig(DEMO.title, DEMO.stations, DEMO.digits, true);
  solved = loadProgress();
  render();
})();
})();
