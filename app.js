const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const colors=['#9b7cff','#5ee6a8','#ff75b8','#5ecbff','#ffb45e','#ff6f91','#a8d76f','#c78cff'];
const categories={
  "😈 Caóticas":"caoticas",
  "😂 Graciosas":"graciosas",
  "❤️ Personales":"personales",
  "🔥 Picantes":"picantes",
  "🧠 Para conocerse":"conocerse"
};
const localQuestions={
  caoticas:["Si mañana te ingresaran un millón de euros, ¿qué sería lo primero que harías?","¿Qué cosa absurda defenderías hasta la muerte?","¿Qué harías si pudieras ser invisible durante una hora?"],
  graciosas:["¿Cuál es la cosa más ridícula que has hecho para evitar una situación incómoda?","¿Qué talento inútil tienes?","¿Qué animal sería tu peor compañero de piso y por qué?"],
  personales:["¿Qué pequeña cosa te mejora el día inmediatamente?","¿Qué viaje recuerdas con más cariño?","¿Qué cosa valoras mucho en una amistad?"],
  picantes:["¿Qué red flag te parece inexplicablemente atractiva?","¿Cuál ha sido tu peor cita?","¿Qué secreto inocente te costaría muchísimo confesar en un grupo?"],
  conocerse:["¿Qué decisión pequeña ha cambiado mucho tu vida?","¿Qué trabajo probarías durante un año si el dinero no importara?","¿Qué cosa suele entender mal la gente sobre ti?"]
};

let state={
  screen:'home', name:'', room:'', category:'😂 Graciosas',
  game:null, me:null, players:[], messages:[], question:null, seconds:180,
  channel:null, timer:null, pollTimer:null, busy:false
};
const app=document.querySelector('#app');

function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function go(screen){state.screen=screen; render()}

function render(){
  app.innerHTML=`<div class="wrap">
    <header class="brand"><div class="logo">?</div><span>UNMASK</span></header>
    ${screens[state.screen]()}
  </div>`;
}

const screens={
home:()=>`<main class="screen center"><section class="card hero">
  <div class="eyebrow">Talk · Guess · Reveal</div>
  <h1>Unmask</h1>
  <p>Habla, investiga y descubre quién se esconde detrás de cada número.</p>
  <div class="actions"><button onclick="go('create')">Crear partida</button><button class="secondary" onclick="go('join')">Unirse a partida</button></div>
  <p class="small">V0.4 · números secretos aleatorios</p>
</section></main>`,

create:()=>`<main class="screen center"><section class="card form">
  <div class="eyebrow">Nueva partida</div><h2>Crear partida</h2>
  <label>Tu nombre</label><input id="name" maxlength="24" placeholder="¿Cómo te llamas?" value="${escapeHtml(state.name)}">
  <label>Categoría</label><select id="cat">${Object.keys(categories).map(x=>`<option ${x===state.category?'selected':''}>${x}</option>`).join('')}</select>
  <label>Jugadores IA <span class="muted">(próximamente)</span></label><select disabled><option>0 por ahora</option></select>
  <div class="actions"><button onclick="createRoom()">Crear partida</button><button class="ghost" onclick="go('home')">Atrás</button></div>
</section></main>`,

join:()=>`<main class="screen center"><section class="card form">
  <div class="eyebrow">Entrar</div><h2>Unirse a partida</h2>
  <label>Tu nombre</label><input id="name" maxlength="24" placeholder="¿Cómo te llamas?">
  <label>Código de sala</label><input id="room" maxlength="6" autocapitalize="characters" placeholder="Ej. K7F2P">
  <div class="actions"><button onclick="joinRoom()">Entrar</button><button class="ghost" onclick="go('home')">Atrás</button></div>
</section></main>`,

lobby:()=>`<main class="screen"><div class="room-grid">
  <section class="panel">
    <div class="eyebrow">Sala</div><div class="roomcode">${escapeHtml(state.room)}</div>
    <p class="small">Comparte este código con tus amigos.</p>
    <div class="lobby-count"><div class="count-number">${state.players.length}</div><div><h3>Jugadores conectados</h3><p class="small">Los números se repartirán al azar cuando empiece la partida.</p></div></div>
    ${state.me?.is_host && state.players.length>=2 ? '<button onclick="startGame()">🚀 Empezar partida</button>' : '<div class="waiting">Esperando al anfitrión…</div>'}
  </section>
  <section class="panel"><h3>Cómo funciona</h3><p>1. Cada jugador recibe un número.</p><p>2. Todos hablan en el mismo chat.</p><p>3. La pregunta cambia por rondas.</p><p>4. Al final intentáis descubrir quién es quién.</p><p class="small">En esta versión estamos probando el multijugador real.</p></section>
</div></main>`,

game:()=>`<main class="screen"><div class="game-grid">
  <section class="panel">
    <div class="eyebrow">Ronda ${state.game?.current_round||1}</div>
    <div class="question">${escapeHtml(state.question?.question || 'Preparando pregunta…')}</div>
    <div class="timer" id="timer">${fmt(state.seconds)}</div>
    <div class="identity" style="border-color:${state.me?.color||'#fff'}">
      <div class="eyebrow">Tu número secreto</div><div class="my-number" style="color:${state.me?.color||'#fff'}">${state.me?.player_number||'?'}</div>
      <div class="small">Tu número se ha repartido al azar al comenzar. Los demás solo lo ven cuando escribes.</div>
    </div>
    <button class="secondary" onclick="finishRound()">Pasar a adivinar →</button>
  </section>
  <section class="panel chat">
    <div class="chat-head"><b>Chat de la partida</b><span class="muted">${state.players.length} jugadores</span></div>
    <div class="messages" id="messages">${state.messages.map(m=>`<div class="msg"><div class="who" style="color:${m.player?.color||'#fff'}">${m.player?.player_number||'?'}</div><div class="bubble">${escapeHtml(m.content)}</div></div>`).join('')}</div>
    <div class="composer"><input id="chatInput" maxlength="500" placeholder="Escribe algo…" onkeydown="if(event.key==='Enter')sendMsg()"><button onclick="sendMsg()">Enviar</button></div>
  </section>
</div></main>`,

guess:()=>`<main class="screen center"><section class="card form">
  <div class="eyebrow">Investigación final</div><h2>¿Quién es quién?</h2>
  <p class="small">Esta pantalla será privada para cada jugador. La puntuación completa la añadiremos en la siguiente versión.</p>
  ${state.players.filter(p=>p.id!==state.me?.id).sort((a,b)=>(a.player_number||0)-(b.player_number||0)).map(p=>`<div class="choice"><b style="color:${p.color}">Número ${p.player_number}</b><select id="guess-${p.id}"><option value="">¿Quién crees que es?</option>${state.players.filter(x=>x.id!==state.me?.id).map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('')}</select></div>`).join('')}
  <button onclick="revealLocal()">Ver identidades (prueba)</button>
</section></main>`,

reveal:()=>`<main class="screen center"><section class="card form">
  <div class="eyebrow">Revelación</div><h2>🎭 ¿Quién estaba detrás?</h2>
  <div class="reveal">${state.players.sort((a,b)=>(a.player_number||0)-(b.player_number||0)).map(p=>`<div><b style="color:${p.color}">${p.player_number}</b> → ${escapeHtml(p.name)}</div>`).join('')}</div>
  <button onclick="leaveGame()">Volver al inicio</button>
</section></main>`
};

async function createRoom(){
  if(state.busy)return; state.busy=true;
  const name=document.querySelector('#name').value.trim()||'Jugador';
  const category=document.querySelector('#cat').value;
  const code=Math.random().toString(36).slice(2,7).toUpperCase();
  const {data:game,error}=await db.from('games').insert({code,status:'waiting',category:categories[category],current_round:0,total_rounds:3}).select().single();
  if(error){state.busy=false; alert('No se pudo crear la partida: '+error.message);return}
  const {data:player,error:pe}=await db.from('players').insert({game_id:game.id,name,player_number:null,color:colors[Math.floor(Math.random()*colors.length)],is_host:true,is_ai:false}).select().single();
  if(pe){alert('No se pudo crear el jugador: '+pe.message);state.busy=false;return}
  state.name=name; state.room=code; state.game=game; state.me=player;
  await enterRealtime(); state.busy=false; go('lobby'); await loadPlayers();
}

async function joinRoom(){
  if(state.busy)return; state.busy=true;
  const name=document.querySelector('#name').value.trim()||'Jugador';
  const code=document.querySelector('#room').value.trim().toUpperCase();
  if(!code){alert('Escribe el código de la sala.');state.busy=false;return}
  const {data:game,error}=await db.from('games').select('*').eq('code',code).maybeSingle();
  if(error||!game){alert('No encontramos esa sala.');state.busy=false;return}
  if(game.status!=='waiting'){alert('Esa partida ya ha empezado.');state.busy=false;return}
  const {count}=await db.from('players').select('id',{count:'exact',head:true}).eq('game_id',game.id);
  if((count||0)>=20){alert('Esta sala está llena.');state.busy=false;return}
  const {data:player,error:pe}=await db.from('players').insert({game_id:game.id,name,player_number:null,color:colors[Math.floor(Math.random()*colors.length)],is_host:false,is_ai:false}).select().single();
  if(pe){alert('No se pudo unir: '+pe.message);state.busy=false;return}
  state.name=name; state.room=code; state.game=game; state.me=player;
  await enterRealtime(); state.busy=false; go('lobby'); await loadPlayers();
}

async function loadPlayers(renderNow=true){
  if(!state.game)return;
  const {data,error}=await db.from('players').select('*').eq('game_id',state.game.id).order('player_number');
  if(!error){state.players=data||[]; state.me=state.players.find(p=>p.id===state.me?.id)||state.me; if(renderNow) render()}
}

async function handleGameUpdate(game){
  if(!game)return;
  const wasPlaying=state.game?.status==='playing';
  state.game=game;
  if(game.status==='playing' && !wasPlaying){
    await loadQuestion();
    go('game');
    startTimer();
  }
}

async function pollGame(){
  if(!state.game)return;
  const {data:game}=await db.from('games').select('*').eq('id',state.game.id).maybeSingle();
  if(game) await handleGameUpdate(game);
  if(state.screen==='lobby') await loadPlayers(true);
  else if(state.screen==='game') await loadPlayers(false);
  if(state.screen==='game') await loadMessages(false);
}

function startPolling(){
  clearInterval(state.pollTimer);
  state.pollTimer=setInterval(()=>{ pollGame().catch(()=>{}); },2000);
}

async function enterRealtime(){
  if(state.channel) await db.removeChannel(state.channel);
  state.channel=db.channel('game-'+state.game.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'players',filter:`game_id=eq.${state.game.id}`},async()=>{await loadPlayers(state.screen==='lobby')})
    .on('postgres_changes',{event:'*',schema:'public',table:'games',filter:`id=eq.${state.game.id}`},async(payload)=>{await handleGameUpdate(payload.new)})
    .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`game_id=eq.${state.game.id}`},async()=>{await loadMessages(state.screen!=='game')})
    .on('postgres_changes',{event:'*',schema:'public',table:'questions',filter:`game_id=eq.${state.game.id}`},async()=>{await loadQuestion()})
    .subscribe();
  startPolling();
  await loadMessages();
}

async function startGame(){
  if(!state.me?.is_host)return;
  if(state.players.length<2){alert('Necesitáis al menos 2 jugadores.');return}
  if(state.busy)return;
  state.busy=true;

  // Los números NO se asignan al entrar. El anfitrión los reparte al azar justo al empezar.
  const {data:players,error:loadError}=await db.from('players').select('id').eq('game_id',state.game.id);
  if(loadError||!players||players.length<2){alert('No se pudieron cargar los jugadores.');state.busy=false;return}
  const shuffled=[...Array(players.length)].map((_,i)=>i+1);
  for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}

  // Primero asignamos todos los números y solo después cambiamos la partida a "playing".
  for(let i=0;i<players.length;i++){
    const {error}=await db.from('players').update({player_number:shuffled[i]}).eq('id',players[i].id);
    if(error){alert('No se pudieron repartir los números: '+error.message);state.busy=false;return}
  }

  const {data:game,error}=await db.from('games').update({status:'playing',current_round:1}).eq('id',state.game.id).select().single();
  if(error){alert('No se pudo iniciar la partida: '+error.message);state.busy=false;return}
  state.game=game;
  await loadPlayers(false);
  await createQuestion(1);
  await loadQuestion(); go('game'); startTimer();
  state.busy=false;
}

async function createQuestion(round){
  const key=state.game.category||'graciosas';
  const arr=localQuestions[key]||localQuestions.graciosas;
  const q=arr[Math.floor(Math.random()*arr.length)];
  const {error}=await db.from('questions').insert({game_id:state.game.id,round,category:key,question:q});
  if(error) console.warn(error);
}

async function loadQuestion(){
  const {data}=await db.from('questions').select('*').eq('game_id',state.game.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(data){state.question=data; render()}
}

async function loadMessages(renderNow=true){
  const {data}=await db.from('messages').select('id,game_id,player_id,content,created_at,players:player_id(id,name,player_number,color)').eq('game_id',state.game.id).order('created_at');
  if(!data)return;
  state.messages=data.map(m=>({id:m.id,content:m.content,created_at:m.created_at,player:m.players}));
  if(renderNow){
    render();
  }else{
    const box=document.querySelector('#messages');
    if(box){
      box.innerHTML=state.messages.map(m=>`<div class="msg"><div class="who" style="color:${m.player?.color||'#fff'}">${m.player?.player_number||'?'}</div><div class="bubble">${escapeHtml(m.content)}</div></div>`).join('');
      box.scrollTo(0,99999);
    }
  }
  setTimeout(()=>document.querySelector('#messages')?.scrollTo(0,99999),20);
}

async function sendMsg(){
  const input=document.querySelector('#chatInput'); const content=input?.value.trim();
  if(!content||!state.me)return;
  input.value='';
  const {error}=await db.from('messages').insert({game_id:state.game.id,player_id:state.me.id,content});
  if(error){alert('No se pudo enviar el mensaje: '+error.message);input.value=content}
}

function startTimer(){
  clearInterval(state.timer); state.seconds=180;
  state.timer=setInterval(()=>{if(state.screen!=='game'){clearInterval(state.timer);return}state.seconds--;const el=document.querySelector('#timer');if(el)el.textContent=fmt(state.seconds);if(state.seconds<=0){clearInterval(state.timer);finishRound()}},1000);
}

function finishRound(){clearInterval(state.timer);go('guess')}
function revealLocal(){go('reveal')}
function leaveGame(){clearInterval(state.pollTimer);if(state.channel)db.removeChannel(state.channel);state={screen:'home',name:'',room:'',category:'😂 Graciosas',game:null,me:null,players:[],messages:[],question:null,seconds:180,channel:null,timer:null,pollTimer:null,busy:false};render()}
render();
