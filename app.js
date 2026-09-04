const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const colors = ['#9b7cff','#5ee6a8','#ff75b8','#5ecbff','#ffb45e','#ff6f91','#a8d76f','#c78cff'];
const categories = {
  '😈 Caóticas':'caoticas',
  '😂 Graciosas':'graciosas',
  '❤️ Personales':'personales',
  '🔥 Picantes':'picantes',
  '🧠 Para conocerse':'conocerse'
};

let state = {
  screen:'home', name:'', room:'', category:'😂 Graciosas',
  game:null, me:null, players:[], messages:[], answers:[], question:null,
  guesses:{}, seconds:180, channel:null, timer:null, poll:null,
  busy:false, ai:false, ai_enabled:false, aiTimer:null, loadError:''
};

const app = document.querySelector('#app');
const esc = (s='') => String(s).replace(/[&<>'"]/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
}[c]));
const fmt = s => String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');

function go(x){ state.screen=x; render(); }

function render(){
  app.innerHTML = `<div class="wrap"><header class="brand"><div class="logo">?</div><span>UNMASK</span></header>${screens[state.screen]()}</div>`;
}

const screens = {
  home:()=>`<main class="screen center"><section class="card hero">
    <div class="eyebrow">Talk · Guess · Reveal</div><h1>Unmask</h1>
    <p>Descubre quién se esconde detrás de cada número.</p>
    <div class="actions"><button onclick="go('create')">Crear partida</button><button class="secondary" onclick="go('join')">Unirse a partida</button></div>
    <p class="small">V1.8 · IA natural + preguntas + investigación corregida</p>
  </section></main>`,

  create:()=>`<main class="screen center"><section class="card form">
    <div class="eyebrow">Nueva partida</div><h2>Crear partida</h2>
    <label>Tu nombre</label><input id="name" maxlength="24" placeholder="¿Cómo te llamas?" value="${esc(state.name)}">
    <label>Categoría</label><select id="cat">${Object.keys(categories).map(x=>`<option ${x===state.category?'selected':''}>${x}</option>`).join('')}
    </select>
    <label class="check"><input id="ai" type="checkbox" ${state.ai?'checked':''}> Añadir jugador IA secreto 🤖</label>
    <p class="small ai-note">La IA tendrá una personalidad aleatoria. Nadie en la partida sabrá cuál le ha tocado.</p>
    <div class="actions"><button onclick="createRoom()">Crear partida</button><button class="ghost" onclick="go('home')">Atrás</button></div>
  </section></main>`,

  join:()=>`<main class="screen center"><section class="card form">
    <div class="eyebrow">Entrar</div><h2>Unirse a partida</h2>
    <label>Tu nombre</label><input id="name" maxlength="24" placeholder="¿Cómo te llamas?">
    <label>Código de sala</label><input id="room" maxlength="6" placeholder="Ej. K7F2P">
    <div class="actions"><button onclick="joinRoom()">Entrar</button><button class="ghost" onclick="go('home')">Atrás</button></div>
  </section></main>`,

  lobby:()=>`<main class="screen"><div class="room-grid">
    <section class="panel"><div class="eyebrow">Sala</div><div class="roomcode">${esc(state.room)}</div>
      <p class="small">Comparte este código. Nadie verá quién ha entrado antes.</p>
      <div class="lobby-count"><div class="count-number">${state.players.length}</div><div>
        <h3>Jugadores conectados</h3><p class="small">Los números se repartirán al azar al comenzar.</p>
      </div></div>
      ${state.loadError?`<div class="error-box">No he podido actualizar los jugadores todavía. Reintentando…</div>`:''}
      ${state.me?.is_host
        ? `<button ${state.players.length<2?'disabled':''} onclick="startGame()">🚀 Empezar partida</button>`
        : '<div class="waiting">Esperando a que empiece la partida…</div>'}
    </section>
    <section class="panel"><h3>Reglas</h3>
      <p>🎲 Número aleatorio para cada persona.</p><p>💬 Chat anónimo por número.</p>
      <p>🤖 Puede haber un jugador IA secreto.</p><p>🕵️ Al final intentas descubrir quién es quién.</p>
    </section>
  </div></main>`,

  game:()=>`<main class="screen"><div class="game-grid">
    <section class="panel chat-panel">
      <div class="eyebrow">Ronda ${state.game?.current_round||1} de ${state.game?.total_rounds||3}</div>
      <div class="question">${esc(state.question?.question||'Preparando pregunta…')}</div>
      <div class="timer" id="timer">${fmt(state.seconds)}</div>

      <div class="identity" style="border-color:${state.me?.color||'#fff'}">
        <div class="eyebrow">Tu número secreto</div>
        <div class="my-number" style="color:${state.me?.color||'#fff'}">${state.me?.player_number||'?'}</div>
        <div class="small">Solo tú sabes qué número eres.</div>
      </div>

      ${state.loadError?`<div class="error-box">${esc(state.loadError)}</div>`:''}

      ${state.me?.is_host?`
        <div class="actions">
          <button class="secondary" onclick="nextQuestion()">Nueva pregunta ↻</button>
          <button class="secondary" onclick="advanceToGuess()">Pasar a investigación →</button>
        </div>
      `:''}
    </section>

    <section class="panel chat">
      <div class="chat-head">
        <b>💬 Chat libre</b>
        <span class="muted">${state.players.length} jugadores</span>
      </div>
      <div class="messages" id="messages">${state.messages.map(m=>{
        const system = !m.player_id;
        return system
          ? `<div class="msg system-msg"><div class="bubble">${esc(m.content)}</div></div>`
          : `<div class="msg"><div class="who" style="color:${m.player?.color||'#fff'}">${m.player?.player_number||'?'}</div><div class="bubble">${esc(m.content)}</div></div>`;
      }).join('')}</div>
      <div class="composer">
        <input id="chatInput" maxlength="500" placeholder="Responde o habla libremente…" onkeydown="if(event.key==='Enter')sendMsg()">
        <button onclick="sendMsg()">Enviar</button>
      </div>
    </section>
  </div></main>`,

  guess:()=>{const nums=[...state.players].filter(p=>p.player_number).sort((a,b)=>a.player_number-b.player_number);
    const others=state.players.filter(p=>p.id!==state.me?.id);
    return `<main class="screen center"><section class="card form"><div class="eyebrow">Investigación final</div><h2>¿Quién es quién?</h2>
      <p class="small">Asigna una persona a cada número. Tu propio número queda bloqueado porque ya sabes quién eres.</p>
      ${nums.map(p=>{
        const isMe=p.id===state.me?.id;
        if(isMe){
          return `<div class="choice"><b style="color:${p.color}">Número ${p.player_number}</b><div class="small" style="padding:14px 0">🔒 Este es tu número. No tienes que asignarte a nadie.</div></div>`;
        }
        return `<div class="choice"><b style="color:${p.color}">Número ${p.player_number}</b><select id="g-${p.player_number}" onchange="rememberGuess(${p.player_number}, this.value)">
          <option value="">¿Quién crees que es?</option>${others.map(x=>`<option value="${x.id}" ${state.guesses[p.player_number]===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}
        </select></div>`;
      }).join('')}
      <div id="guessResult"></div>
      <button id="confirmGuessesBtn" onclick="submitGuesses()">Confirmar mis sospechas</button>
    </section></main>`},

  reveal:()=>{const nums=[...state.players].sort((a,b)=>a.player_number-b.player_number);
    return `<main class="screen center"><section class="card form"><div class="eyebrow">Revelación</div><h2>🎭 ¿Quién estaba detrás?</h2>
      <div class="reveal">${nums.map(p=>`<div><b style="color:${p.color}">${p.player_number}</b> → ${esc(p.name)} ${p.is_ai?'🤖':''}</div>`).join('')}</div>
      <h3>🏆 Resultados</h3><div id="scoreboard">Calculando…</div><button onclick="leaveGame()">Volver al inicio</button>
    </section></main>`}
};

async function createRoom(){

  if(state.busy)return;
  state.busy=true;

  try{
    const name=document.querySelector('#name').value.trim()||'Jugador';
    state.category=document.querySelector('#cat').value;
    state.ai=!!document.querySelector('#ai').checked;

    const code=Math.random().toString(36).slice(2,7).toUpperCase();

    const {data:game,error}=await db.from('games').insert({
      code,status:'waiting',phase:'lobby',
      category:categories[state.category],
      current_round:0,total_rounds:3,
      ai_enabled:state.ai,
      ai_personality:null
    }).select().single();

    if(error)throw error;

    const {data:me,error:pe}=await db.from('players').insert({
      game_id:game.id,
      name,
      player_number:null,
      color:colors[Math.floor(Math.random()*colors.length)],
      is_host:true,
      is_ai:false
    }).select().single();

    if(pe)throw pe;

    state.players=[me];

    if(state.ai){
      const {data:aiPlayer,error:aiError}=await db.from('players').insert({
        game_id:game.id,
        name:'ROBOT',
        player_number:null,
        color:colors[Math.floor(Math.random()*colors.length)],
        is_host:false,
        is_ai:true
      }).select().single();

      if(aiError)throw aiError;
      if(aiPlayer)state.players.push(aiPlayer);
    }

    state.name=name;
    state.room=code;
    state.game=game;
    state.me=me;
    state.ai_enabled=state.ai;

    await realtime();
    go('lobby');
    await loadAll(true);

  }catch(e){
    console.error(e);
    alert(e?.message||'No se pudo crear la partida.');
  }finally{
    state.busy=false;
  }
}

async function joinRoom(){

  if(state.busy)return;
  state.busy=true;

  try{
    const name=document.querySelector('#name').value.trim()||'Jugador';
    const code=document.querySelector('#room').value.trim().toUpperCase();

    const {data:game,error:ge}=await db.from('games')
      .select('*').eq('code',code).maybeSingle();

    if(ge)throw ge;
    if(!game){alert('No encontramos esa sala.');return;}
    if(game.status!=='waiting'){alert('La partida ya ha empezado.');return;}

    const {count,error:ce}=await db.from('players')
      .select('id',{count:'exact',head:true})
      .eq('game_id',game.id);

    if(ce)throw ce;
    if((count||0)>=20){alert('Sala llena.');return;}

    const {data:me,error}=await db.from('players').insert({
      game_id:game.id,
      name,
      player_number:null,
      color:colors[Math.floor(Math.random()*colors.length)],
      is_host:false,
      is_ai:false
    }).select().single();

    if(error)throw error;

    state.name=name;
    state.room=code;
    state.game=game;
    state.me=me;
    state.ai_enabled=!!game.ai_enabled;
    state.players=[me];

    await realtime();
    go('lobby');
    await loadAll(true);

  }catch(e){
    console.error(e);
    alert(e?.message||'No se pudo entrar en la partida.');
  }finally{
    state.busy=false;
  }
}

async function loadAll(redraw=false){

  if(!state.game)return;

  // Comprobamos también el estado de la partida en cada polling.
  // Así los móviles detectan el inicio aunque Realtime falle.
  const {data:latestGame,error:gameError}=await db.from('games')
    .select('*').eq('id',state.game.id).maybeSingle();

  if(!gameError && latestGame){
    const previousStatus=state.game.status;
    state.game=latestGame;
    state.ai_enabled=!!latestGame.ai_enabled;

    if(previousStatus!==latestGame.status){

      if(latestGame.status==='playing' && state.screen==='lobby'){
        await refreshPlayers();
        await loadQuestion(false);
        go('game');
        startTimer();
        scheduleAIIfHost();
      }

      if(latestGame.status==='guessing' &&
         state.screen!=='guess' &&
         state.screen!=='reveal'){
        clearInterval(state.timer);
        await refreshPlayers();
        go('guess');
      }

      if(latestGame.status==='finished' &&
         state.screen!=='reveal'){
        clearInterval(state.timer);
        await refreshPlayers();
        go('reveal');
        setTimeout(loadScores,300);
      }
    }
  }

  await refreshPlayers();

  await Promise.allSettled([
    loadMessages(false),
    loadQuestion(false)
  ]);

  if(state.screen==='reveal')loadScores();

  if(redraw || state.screen==='lobby')render();
}

async function refreshPlayers(){

  if(!state.game)return false;

  const {data:p,error}=await db.from('players')
    .select('id,name,player_number,color,is_host,is_ai,created_at')
    .eq('game_id',state.game.id)
    .order('created_at',{ascending:true});

  if(error){
    console.error('Error cargando jugadores:',error);
    state.loadError=error.message||'Error cargando jugadores';

    if(state.me && !state.players.some(x=>x.id===state.me.id)){
      state.players=[state.me,...state.players];
    }
    return false;
  }

  state.loadError='';
  state.players=p||[];

  if(state.me){
    state.me=state.players.find(x=>x.id===state.me.id)||state.me;
  }

  return true;
}

async function loadMessages(r=true){
  if(!state.game)return;
  const {data,error}=await db.from('messages')
    .select('id,player_id,content,created_at,players:player_id(id,player_number,color,is_ai)')
    .eq('game_id',state.game.id).order('created_at');
  if(error){console.error('Error cargando mensajes:',error);return;}
  state.messages=(data||[]).map(m=>({...m,player:m.players}));
  if(r)render();else updateChat();
}

function updateChat(){
  const box=document.querySelector('#messages');
  if(box){
    box.innerHTML=state.messages.map(m=>`<div class="msg"><div class="who" style="color:${m.player?.color||'#fff'}">${m.player?.player_number||'?'}</div><div class="bubble">${esc(m.content)}</div></div>`).join('');
    box.scrollTo(0,99999);
  }
}

async function loadQuestion(r=true){

  if(!state.game)return;

  const round=state.game.current_round||1;
  const {data,error}=await db.from('questions')
    .select('*')
    .eq('game_id',state.game.id)
    .eq('round',round)
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();

  if(error){
    console.error('Error cargando pregunta:',error);
    return;
  }

  if(data)state.question=data;

  // Cuando llega por Realtime/polling no reconstruimos toda la pantalla
  // para no borrar lo que alguien está escribiendo en el chat.
  const questionBox=document.querySelector('.question');
  if(questionBox && state.question){
    questionBox.textContent=state.question.question;
  }else if(r){
    render();
  }
}

async function realtime(){
  if(state.channel)await db.removeChannel(state.channel);
  state.channel=db.channel('unmask-'+state.game.id)
    .on('postgres_changes',{event:'*',schema:'public',table:'players',filter:`game_id=eq.${state.game.id}`},()=>loadAll(false))
    .on('postgres_changes',{event:'*',schema:'public',table:'games',filter:`id=eq.${state.game.id}`},p=>handleGame(p.new))
    .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`game_id=eq.${state.game.id}`},()=>loadMessages(false))
    .on('postgres_changes',{event:'*',schema:'public',table:'questions',filter:`game_id=eq.${state.game.id}`},()=>loadQuestion(false))
    .on('postgres_changes',{event:'*',schema:'public',table:'answers',filter:`game_id=eq.${state.game.id}`},()=>loadAnswers(false))
    .subscribe();

  clearInterval(state.poll);
  state.poll=setInterval(()=>loadAll(false).catch(console.error),2500);
}

async function handleGame(g){
  if(!g)return;
  const old=state.game?.status;state.game=g;
  if(g.status==='playing'&&old!=='playing'){
    await loadAll(false);go('game');startTimer();
  }
  if(g.status==='guessing'&&state.screen!=='guess'&&state.screen!=='reveal'){
    clearInterval(state.timer);await loadAll(false);go('guess');
  }
  if(g.status==='finished'&&state.screen!=='reveal'){
    await loadAll(false);go('reveal');setTimeout(loadScores,300);
  }
}

async function startGame(){

  if(!state.me?.is_host || state.players.length<2 || state.busy)return;

  state.busy=true;

  try{
    const p=state.players.filter(x=>!x.player_number);
    const nums=[...Array(p.length)].map((_,i)=>i+1);

    for(let i=nums.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [nums[i],nums[j]]=[nums[j],nums[i]];
    }

    // Asignamos todos los números antes de cambiar el estado a playing.
    for(let i=0;i<p.length;i++){
      const {error}=await db.from('players')
        .update({player_number:nums[i]})
        .eq('id',p[i].id);

      if(error)throw error;
    }

    const {data:assigned,error:assignedError}=await db.from('players')
      .select('id,name,player_number,color,is_host,is_ai,created_at')
      .eq('game_id',state.game.id)
      .order('created_at',{ascending:true});

    if(assignedError)throw assignedError;

    state.players=assigned||state.players;
    state.me=state.players.find(x=>x.id===state.me.id)||state.me;

    if(state.players.some(p=>!p.player_number)){
      throw new Error('No se pudieron asignar todos los números secretos.');
    }

    const {data:g,error}=await db.from('games')
      .update({
        status:'playing',
        phase:'answers',
        current_round:1
      })
      .eq('id',state.game.id)
      .select()
      .single();

    if(error)throw error;

    state.game=g;
    state.ai_enabled=!!g.ai_enabled;

    const questionReady=await generateQuestion();

    await loadAll(false);

    go('game');
    startTimer();

    if(!questionReady){
      setTimeout(async()=>{
        const ok=await generateQuestion();
        await loadQuestion(false);
        if(!ok){
          state.loadError='La pregunta todavía no está disponible. Reintentando…';
          render();

          setTimeout(async()=>{
            const finalOk=await generateQuestion();
            await loadQuestion(false);

            if(finalOk){
              state.loadError='';
              render();
            }
          },3500);
        }else{
          render();
        }
      },2500);
    }

    scheduleAIIfHost();

  }catch(e){
    console.error(e);
    alert(e?.message||'No se pudo empezar la partida.');
  }finally{
    state.busy=false;
  }
}

async function generateQuestion(){

  if(!state.game)return false;

  const round=state.game.current_round||1;

  const {data:q,error:qError}=await db.from('questions')
    .select('*')
    .eq('game_id',state.game.id)
    .eq('round',round)
    .maybeSingle();

  if(qError)console.error('Error consultando pregunta:',qError);

  if(q){
    state.question=q;
    state.loadError='';
    return true;
  }

  try{
    const r=await fetch(`${SUPABASE_URL}/functions/v1/unmask-ai`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':SUPABASE_PUBLISHABLE_KEY
      },
      body:JSON.stringify({
        action:'question',
        game_id:state.game.id
      })
    });

    const j=await r.json().catch(()=>({}));

    if(!r.ok || !j.ok){
      console.error('Error generando pregunta:',j);
      state.loadError=j?.error||`Error generando pregunta (${r.status})`;
      return false;
    }

    state.loadError='';
    if(j.question)state.question=j.question;

    // La pregunta se muestra en su panel propio. No la metemos en messages
    // porque player_id puede ser obligatorio y el chat debe contener solo jugadores.
    await loadQuestion(false);
    return !!state.question?.question;

  }catch(e){
    console.error('Error llamando a unmask-ai:',e);
    state.loadError=e?.message||'No se pudo conectar con la IA.';
    return false;
  }
}

async function triggerAI(delayMin=1800,delayMax=6800){

  if(!state.ai_enabled || !state.players.some(p=>p.is_ai))return;

  clearTimeout(state.aiTimer);

  state.aiTimer=setTimeout(async()=>{
    state.aiTimer=null;

    try{
      const r=await fetch(`${SUPABASE_URL}/functions/v1/unmask-ai`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':SUPABASE_PUBLISHABLE_KEY
        },
        body:JSON.stringify({
          action:'ai_turn',
          game_id:state.game.id
        })
      });

      const j=await r.json().catch(()=>({}));
      if(!r.ok || !j.ok)console.warn('Turno IA:',j?.error||r.status);

    }catch(e){
      console.warn('Turno IA:',e);
    }
  },delayMin+Math.random()*(delayMax-delayMin));
}

function scheduleAIIfHost(){
  if(!state.me?.is_host || !state.ai_enabled)return;
  // Primera intervención después de que el grupo haya tenido tiempo de responder.
  triggerAI(9000,16000);
}

async function sendMsg(){

  const i=document.querySelector('#chatInput');
  const content=i?.value.trim();

  if(!content)return;

  i.value='';

  const {error}=await db.from('messages').insert({
    game_id:state.game.id,
    player_id:state.me.id,
    content
  });

  if(error){
    alert(error.message);
    i.value=content;
    return;
  }

  if(state.me?.is_host && state.ai_enabled){
    // La IA no responde a todos los mensajes. Espera varios segundos para que parezca un jugador real.
    if(Math.random()<0.32) triggerAI(6500,14500);
  }
}

function startTimer(){
  clearInterval(state.timer);state.seconds=180;
  state.timer=setInterval(()=>{
    if(state.screen!=='game'){clearInterval(state.timer);return;}
    state.seconds--;const el=document.querySelector('#timer');if(el)el.textContent=fmt(state.seconds);
    if(state.seconds<=0){clearInterval(state.timer);if(state.me?.is_host)advanceToGuess();}
  },1000);
}

async function nextQuestion(){
  if(!state.me?.is_host || state.busy || !state.game)return;

  state.busy=true;
  try{
    const nextRound=(state.game.current_round||0)+1;

    const {data:g,error}=await db.from('games')
      .update({
        current_round:nextRound,
        total_rounds:Math.max(state.game.total_rounds||3,nextRound),
        status:'playing',
        phase:'answers'
      })
      .eq('id',state.game.id)
      .select()
      .single();

    if(error)throw error;

    state.game=g;
    state.question=null;
    state.loadError='';
    state.seconds=180;
    render();
    startTimer();

    const ok=await generateQuestion();
    await loadQuestion(false);

    if(!ok){
      state.loadError='No se pudo generar la pregunta. Puedes pulsar «Nueva pregunta» para reintentarlo.';
      render();
    }else{
      render();
    }

    scheduleAIIfHost();
  }catch(e){
    console.error(e);
    alert(e?.message||'No se pudo pasar a la siguiente pregunta.');
  }finally{
    state.busy=false;
  }
}

async function advanceToGuess(){
  if(!state.me?.is_host)return;
  clearInterval(state.timer);
  const {data:g,error}=await db.from('games').update({status:'guessing',phase:'guessing'})
    .eq('id',state.game.id).select().single();
  if(error)alert(error.message);else if(g)handleGame(g);
}

function rememberGuess(number, value){
  if(!value){
    delete state.guesses[number];
    return;
  }
  if(value===state.me?.id){
    const el=document.querySelector(`#g-${number}`);
    if(el)el.value='';
    delete state.guesses[number];
    return;
  }
  state.guesses[number]=value;
}

async function submitGuesses(){

  if(!state.game || !state.me)return;

  const nums=[...state.players]
    .filter(p=>p.player_number)
    .sort((a,b)=>a.player_number-b.player_number);

  const targets=nums.filter(p=>p.id!==state.me.id);
  const selections={};
  const selectedPeople=new Set();

  for(const p of targets){
    const v=document.querySelector(`#g-${p.player_number}`)?.value||'';

    if(!v){
      const box=document.querySelector('#guessResult');
      if(box)box.innerHTML='<div class="error-box">Te falta elegir una persona para cada número.</div>';
      return;
    }

    if(v===state.me.id){
      const box=document.querySelector('#guessResult');
      if(box)box.innerHTML='<div class="error-box">No puedes elegirte a ti mismo.</div>';
      return;
    }

    if(selectedPeople.has(v)){
      const box=document.querySelector('#guessResult');
      if(box)box.innerHTML='<div class="error-box">Cada persona solo puede estar asignada a un número. Revisa tus sospechas.</div>';
      return;
    }

    selectedPeople.add(v);
    selections[p.player_number]=v;
  }

  const btn=document.querySelector('#confirmGuessesBtn');
  if(btn)btn.disabled=true;

  state.guesses=selections;

  // Guardamos las sospechas de esta ronda de forma segura:
  // primero eliminamos las anteriores del mismo jugador y después insertamos.
  const {error:deleteError}=await db.from('guesses')
    .delete()
    .eq('game_id',state.game.id)
    .eq('round',state.game.current_round)
    .eq('guesser_id',state.me.id);

  if(deleteError){
    console.error('Error borrando sospechas anteriores:',deleteError);
    if(btn)btn.disabled=false;
    const box=document.querySelector('#guessResult');
    if(box)box.innerHTML=`<div class="error-box">No se pudieron guardar tus sospechas: ${esc(deleteError.message)}</div>`;
    return;
  }

  const rows=targets.map(p=>({
    game_id:state.game.id,
    round:state.game.current_round,
    guesser_id:state.me.id,
    target_player_id:p.id,
    guessed_number:p.player_number,
    guessed_player_id:selections[p.player_number],
    guessed_name:state.players.find(x=>x.id===selections[p.player_number])?.name || '',
    is_correct:selections[p.player_number]===p.id
  }));

  const {error:insertError}=await db.from('guesses').insert(rows);

  if(insertError){
    console.error('Error guardando sospechas:',insertError);
    if(btn)btn.disabled=false;
    const box=document.querySelector('#guessResult');
    if(box)box.innerHTML=`<div class="error-box">No se pudieron guardar tus sospechas: ${esc(insertError.message)}</div>`;
    return;
  }

  const points=targets.reduce((total,p)=>{
    return total+(selections[p.player_number]===p.id?1:0);
  },0);

  const total=targets.length;
  const resultBox=document.querySelector('#guessResult');

  if(resultBox){
    resultBox.innerHTML=`
      <div class="result-box">
        <h3>🎯 Sospechas confirmadas</h3>
        <p>Has acertado <b>${points} de ${total}</b>.</p>
        <p class="small">${points===1?'Has conseguido 1 punto.':`Has conseguido ${points} puntos.`}</p>
        <p class="small">Esperando a los demás jugadores…</p>
      </div>`;
  }

  // Comprobamos si todos los jugadores humanos han terminado.
  const humans=state.players.filter(p=>!p.is_ai);
  const {data:allGuesses,error:guessError}=await db.from('guesses')
    .select('guesser_id,guessed_number')
    .eq('game_id',state.game.id)
    .eq('round',state.game.current_round);

  if(guessError){
    console.error('Error comprobando sospechas:',guessError);
    return;
  }

  const neededPerHuman=Math.max(0,state.players.length-1);

  const completeHumans=humans.every(h=>{
    const mine=(allGuesses||[]).filter(g=>g.guesser_id===h.id);
    return new Set(mine.map(g=>g.guessed_number)).size>=neededPerHuman;
  });

  if(completeHumans && state.me.is_host){
    const {data:g,error}=await db.from('games')
      .update({status:'finished',phase:'reveal'})
      .eq('id',state.game.id)
      .select()
      .single();

    if(error){
      console.error('Error terminando partida:',error);
      return;
    }

    if(g)handleGame(g);
  }
}

async function loadScores(){
  const {data:guesses}=await db.from('guesses').select('guesser_id,guessed_number,guessed_player_id')
    .eq('game_id',state.game.id);
  const scores={};(state.players||[]).filter(p=>!p.is_ai).forEach(p=>scores[p.id]=0);
  (guesses||[]).forEach(g=>{
    const actual=state.players.find(p=>p.player_number===g.guessed_number);
    if(actual&&actual.id===g.guessed_player_id)scores[g.guesser_id]=(scores[g.guesser_id]||0)+1;
  });
  const box=document.querySelector('#scoreboard');
  if(box)box.innerHTML=Object.entries(scores).map(([id,s])=>`<div>${esc(state.players.find(p=>p.id===id)?.name||'Jugador')}: <b>${s}</b> puntos</div>`).join('');
}

function leaveGame(){
  clearInterval(state.poll);
  clearTimeout(state.aiTimer);
  if(state.channel)db.removeChannel(state.channel);
  state={...state,screen:'home',game:null,me:null,players:[],messages:[],answers:[],question:null,guesses:{},room:'',name:'',ai:false,loadError:''};
  render();
}

render();
