// Fixed full Slither-like single-player game (with AIs)
// Improvements over previous: proper high-DPI canvas sizing, reliable camera centering, guaranteed initial player segments, safer collision math.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// handle high-DPI canvas properly
function resizeCanvas(){
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  W = window.innerWidth; H = window.innerHeight;
}
let W = window.innerWidth, H = window.innerHeight;
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const playerNameInput = document.getElementById('playerName');
const scoreEl = document.getElementById('scoreVal');
const leadersEl = document.getElementById('leaders');

let mouse = {x: W/2, y: H/2, down:false};
window.addEventListener('mousemove', e=>{ mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', ()=> mouse.down = true);
window.addEventListener('mouseup', ()=> mouse.down = false);
window.addEventListener('keydown', e=>{ if(e.code==='Space') mouse.down = true; });
window.addEventListener('keyup', e=>{ if(e.code==='Space') mouse.down = false; });

// utilities
const rand = (a,b)=>Math.random()*(b-a)+a;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const dist2 = (ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };

class Orb {
  constructor(x,y,r){
    this.x = x; this.y = y; this.r = r || rand(3,7);
    this.color = `hsl(${Math.floor(rand(0,360))} 80% 60%)`;
  }
  draw(){
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.stroke();
  }
}

class Snake {
  constructor(x,y,color,name='Bot',isPlayer=false){
    this.x = x; this.y = y;
    this.dir = 0;
    this.speed = 1.6;
    this.segments = [];
    this.segmentSpacing = 6; // pixels between recorded segments
    this.size = 12;
    this.len = 40; // number of recorded segments target
    this.color = color;
    this.name = name;
    this.dead = false;
    this.turnSpeed = 0.06;
    this.boost = 1;
    this.isPlayer = isPlayer;
    // initialize segments in a line so the snake is visible immediately
    for(let i=0;i<Math.max(20, this.len); i++){
      this.segments.push({x: this.x - i*this.segmentSpacing, y: this.y});
    }
  }
  headPos(){ return this.segments[0] || {x:this.x,y:this.y}; }
  update(target){
    if(this.dead) return;
    // steer towards target
    let targetX = target.x, targetY = target.y;
    let ang = Math.atan2(targetY - this.y, targetX - this.x);
    let da = ang - this.dir;
    // normalize
    da = ((da + Math.PI) % (Math.PI*2)) - Math.PI;
    this.dir += clamp(da, -this.turnSpeed, this.turnSpeed);
    // move
    const spd = this.speed * this.boost;
    this.x += Math.cos(this.dir) * spd;
    this.y += Math.sin(this.dir) * spd;
    // record new head position at spacing
    const head = this.headPos();
    const dx = this.x - head.x, dy = this.y - head.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if(d >= this.segmentSpacing){
      // insert at front
      this.segments.unshift({x: this.x, y: this.y});
    } else {
      // if not far enough, still update head pos for smoothness
      if(this.segments.length) this.segments[0] = {x:this.x, y:this.y};
      else this.segments.unshift({x:this.x, y:this.y});
    }
    // trim to desired length (len controls how many segments)
    while(this.segments.length > Math.max(10, Math.floor(this.len))){
      this.segments.pop();
    }
  }
  draw(){
    if(this.dead) return;
    // body (draw from tail to head for nicer overlap)
    for(let i=this.segments.length-1;i>=0;i--){
      const p = this.segments[i];
      const t = i / Math.max(1, this.segments.length-1);
      // radius tapering: head larger, tail smaller
      const r = this.size * (0.6 + 0.7*(1 - t));
      ctx.beginPath();
      ctx.fillStyle = this.color;
      ctx.arc(p.x, p.y, r, 0, Math.PI*2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.stroke();
    }
    // head outline and name
    const head = this.headPos();
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00000066';
    ctx.arc(head.x, head.y, this.size+2, 0, Math.PI*2);
    ctx.stroke();
    if(this.name){
      ctx.font = "14px Arial";
      ctx.fillStyle = "#ffffffcc";
      ctx.fillText(this.name, head.x + this.size + 6, head.y - this.size - 2);
    }
  }
  eatOrb(orb){
    // grow length proportional to orb size
    this.len += orb.r * 1.2 + 2;
  }
}

let orbs = [];
let snakes = [];
let player;
let world = {w: 3000, h: 2000}; // larger world than screen for roaming
let lastTime = performance.now();

function spawnOrbs(n=200){
  for(let i=0;i<n;i++){
    orbs.push(new Orb(rand(0, world.w), rand(0, world.h), rand(3,6)));
  }
}

function spawnAIs(n=6){
  const colors = ["#ff6b6b","#6bc3ff","#ffd36b","#b36bff","#6bff9a","#ff6bd6","#86a3ff","#ff8e6b"];
  for(let i=0;i<n;i++){
    let s = new Snake(rand(200, world.w-200), rand(200, world.h-200), colors[i%colors.length], "Bot"+(i+1), false);
    s.speed = rand(1.0, 1.9);
    s.turnSpeed = rand(0.03, 0.09);
    s.len = rand(30, 90);
    snakes.push(s);
  }
}

function init(){
  orbs = [];
  snakes = [];
  spawnOrbs(260);
  spawnAIs(7);
  player = new Snake(world.w/2, world.h/2, '#6be0a6', 'You', true);
  player.speed = 1.9;
  player.size = 14;
  player.len = 60;
  snakes.push(player);
}

init();

function update(dt){
  // player target = screen-space mouse converted to world-space
  const cam = getCamera();
  const mouseWorld = { x: cam.x + mouse.x, y: cam.y + mouse.y };
  player.boost = mouse.down ? 2.2 : 1.0;
  // update all snakes
  for(let s of snakes){
    if(s.isPlayer){
      s.update(mouseWorld);
    } else {
      // choose target: either an orb or wander point
      if(!s.target || Math.random() < 0.01) s.target = orbs[Math.floor(rand(0, orbs.length))] || {x: rand(0, world.w), y: rand(0, world.h)};
      // occasionally target player if big enough
      if(Math.random() < 0.002 && player.len > s.len * 1.2) s.target = player.headPos();
      s.boost = (Math.random() < 0.01) ? 2.0 : 1.0;
      s.update(s.target);
    }
    // wrap within world bounds simply (teleport to opposite edge)
    if(s.x < 0) s.x += world.w;
    if(s.y < 0) s.y += world.h;
    if(s.x > world.w) s.x -= world.w;
    if(s.y > world.h) s.y -= world.h;
  }
  // handle orb collisions
  for(let i=orbs.length-1;i>=0;i--){
    const o = orbs[i];
    for(let s of snakes){
      if(s.dead) continue;
      const h = s.headPos();
      const rSum = (s.size + o.r);
      if(dist2(h.x,h.y,o.x,o.y) < rSum*rSum){
        s.eatOrb(o);
        orbs.splice(i,1);
        // spawn new orb at random location
        orbs.push(new Orb(rand(0, world.w), rand(0, world.h), rand(3,6)));
        break;
      }
    }
  }
  // collisions between heads and segments
  checkCollisions();
  updateLeaderboard();
}

function checkCollisions(){
  for(let i=0;i<snakes.length;i++){
    let a = snakes[i];
    if(a.dead) continue;
    const ah = a.headPos();
    for(let j=0;j<snakes.length;j++){
      if(i===j) continue;
      const b = snakes[j];
      // iterate b's segments (skip the first few to reduce instant kills by same head area)
      for(let k=2;k<b.segments.length;k+=2){
        const seg = b.segments[k];
        if(!seg) continue;
        const hitR = Math.max(6, b.size * (1 - k / Math.max(1,b.segments.length) * 0.9));
        if(dist2(ah.x,ah.y,seg.x,seg.y) < hitR*hitR){
          // 'a' dies: turn its segments into orbs
          a.dead = true;
          for(let s of a.segments){
            orbs.push(new Orb(s.x + rand(-8,8), s.y + rand(-8,8), rand(2,6)));
          }
          // smaller snakes respawn automatically
          if(!a.isPlayer){
            setTimeout(()=>{
              a.dead = false;
              a.x = rand(100, world.w-100); a.y = rand(100, world.h-100);
              a.segments = [];
              for(let ii=0; ii<30; ii++) a.segments.push({x: a.x - ii*a.segmentSpacing, y: a.y});
              a.len = rand(20,70);
            }, 1200 + Math.random()*2000);
          } else {
            // player death: respawn near center after short delay
            setTimeout(()=>{ respawnPlayer(); }, 900);
          }
          break;
        }
      }
      if(a.dead) break;
    }
  }
}

function respawnPlayer(){
  player.dead = false;
  player.x = world.w/2; player.y = world.h/2;
  player.segments = [];
  for(let i=0;i<40;i++) player.segments.push({x: player.x - i*player.segmentSpacing, y: player.y});
  player.len = 60;
  player.speed = 1.9;
}

function getCamera(){
  // center camera on player, but clamp to world bounds so we don't show outside the world
  const cx = clamp(player.x - W/2, 0, Math.max(0, world.w - W));
  const cy = clamp(player.y - H/2, 0, Math.max(0, world.h - H));
  return {x: cx, y: cy};
}

function draw(){
  // background
  const cam = getCamera();
  ctx.save();
  // clear full screen
  ctx.fillStyle = '#081122';
  ctx.fillRect(0,0,W,H);

  // draw world (translate to camera)
  ctx.translate(-cam.x, -cam.y);

  // subtle grid for world reference
  const gridSize = 200;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  for(let gx = 0; gx < world.w; gx += gridSize){
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, world.h); ctx.stroke();
  }
  for(let gy = 0; gy < world.h; gy += gridSize){
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(world.w, gy); ctx.stroke();
  }

  // draw orbs and snakes
  for(const o of orbs) o.draw();
  const sorted = snakes.slice().sort((a,b)=>a.len - b.len);
  for(const s of sorted) s.draw();

  ctx.restore();
}

function updateLeaderboard(){
  const tops = snakes.filter(s=>!s.dead).slice().sort((a,b)=>b.len - a.len).slice(0,6);
  leadersEl.innerHTML = '';
  for(const s of tops){
    const li = document.createElement('li');
    const name = s.isPlayer ? (playerNameInput.value || 'Player') : s.name;
    li.textContent = `${name} — ${Math.round(s.len)}`;
    leadersEl.appendChild(li);
  }
  scoreEl.textContent = Math.round(player.len);
}

// main loop
function loop(t){
  const dt = Math.min(40, t - lastTime);
  lastTime = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// periodic orb spawn if low
setInterval(()=>{ if(orbs.length < 300) orbs.push(new Orb(rand(0, world.w), rand(0, world.h), rand(3,6))); }, 700);

// allow renaming
playerNameInput.addEventListener('input', ()=>{ player.name = playerNameInput.value || 'You'; });

// small helper for random used inside class closures
function rand(a,b){ return Math.random()*(b-a)+a; }
