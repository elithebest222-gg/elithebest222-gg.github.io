// Simple Slither-like single-player game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;

window.addEventListener('resize', ()=>{W = canvas.width = innerWidth; H = canvas.height = innerHeight});

const rand = (a,b)=>Math.random()*(b-a)+a;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

const playerNameInput = document.getElementById('playerName');
const scoreEl = document.getElementById('scoreVal');
const leadersEl = document.getElementById('leaders');

let mouse = {x: W/2, y: H/2, down:false};
window.addEventListener('mousemove', e=>{mouse.x = e.clientX; mouse.y = e.clientY});
window.addEventListener('mousedown', ()=>mouse.down = true);
window.addEventListener('mouseup', ()=>mouse.down = false);
window.addEventListener('keydown', e=>{ if(e.code==='Space') mouse.down = true; });
window.addEventListener('keyup', e=>{ if(e.code==='Space') mouse.down = false; });

class Orb {
  constructor(x,y,r){
    this.x=x; this.y=y; this.r=r||rand(3,7);
    this.color = `hsl(${rand(0,360)|0} 80% 60%)`;
  }
  draw(){
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
    ctx.fill();
  }
}

class Snake {
  constructor(x,y, color, name='Bot'){
    this.x=x; this.y=y;
    this.dir = 0;
    this.speed = 1.6;
    this.segments = [];
    this.size = 12;
    this.len = 30;
    this.color = color;
    this.name = name;
    this.dead = false;
    this.turnSpeed = 0.05;
    this.boost = 1;
  }
  update(target){
    if(this.dead) return;
    // simple steering toward target (object with x,y)
    let ang = Math.atan2(target.y - this.y, target.x - this.x);
    let da = ang - this.dir;
    da = ((da+Math.PI)%(Math.PI*2))-Math.PI;
    this.dir += clamp(da, -this.turnSpeed, this.turnSpeed);
    // speed with boost
    let spd = this.speed * this.boost;
    this.x += Math.cos(this.dir)*spd;
    this.y += Math.sin(this.dir)*spd;
    this.segments.unshift({x:this.x,y:this.y});
    while(this.segments.length > this.len) this.segments.pop();
  }
  draw(){
    if(this.dead) return;
    // draw body
    for(let i=0;i<this.segments.length;i++){
      let p = this.segments[i];
      let t = i/this.segments.length;
      let r = this.size*(1 - t*0.9);
      ctx.beginPath();
      ctx.fillStyle = this.color;
      ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fill();
    }
    // head outline
    const head = this.segments[0] || {x:this.x,y:this.y};
    ctx.beginPath();
    ctx.strokeStyle = '#00000055';
    ctx.lineWidth = 2;
    ctx.arc(head.x, head.y, this.size+2,0,Math.PI*2);
    ctx.stroke();
    // name
    if(this.name){
      ctx.font = "14px Arial";
      ctx.fillStyle = "#ffffffcc";
      ctx.fillText(this.name, head.x+this.size+6, head.y- this.size -2);
    }
  }
  eatOrb(orb){
    this.len += orb.r*0.6 + 1.5;
  }
  headPos(){ return this.segments[0] || {x:this.x,y:this.y}; }
}

let orbs = [];
let snakes = [];
let player;
let leaderboard = [];

function spawnOrbs(n=150){
  for(let i=0;i<n;i++){
    orbs.push(new Orb(rand(0,W), rand(0,H), rand(3,6)));
  }
}
function spawnAIs(n=6){
  const colors = ["#ff6b6b","#6bc3ff","#ffd36b","#b36bff","#6bff9a","#ff6bd6"];
  for(let i=0;i<n;i++){
    let s = new Snake(rand(100,W-100), rand(100,H-100), colors[i%colors.length], "Bot"+(i+1));
    s.speed = rand(1,1.8);
    s.turnSpeed = rand(0.03,0.09);
    snakes.push(s);
  }
}

function init(){
  orbs = [];
  snakes = [];
  spawnOrbs(220);
  spawnAIs(6);
  player = new Snake(W/2, H/2, '#6be0a6', 'You');
  player.speed = 1.9;
  player.size = 14;
  player.len = 40;
  snakes.push(player);
}
init();

function update(){
  // player target is mouse
  const mx = mouse.x;
  const my = mouse.y;
  // handle boost
  player.boost = mouse.down ? 2.2 : 1.0;
  // update snakes
  for(let s of snakes){
    if(s === player){
      s.update({x:mx,y:my});
    } else {
      // AIs choose nearest orb or wander
      if(rand(0,1) < 0.02) s.targetOrb = orbs[(rand(0,orbs.length)|0)];
      if(!s.targetOrb || rand(0,1) < 0.005) s.targetOrb = orbs[(rand(0,orbs.length)|0)];
      let target = s.targetOrb || {x:rand(0,W), y:rand(0,H)};
      // occasionally boost
      s.boost = (Math.random()<0.01)?2.0:1.0;
      s.update(target);
    }
    // clamp inside world
    s.x = ((s.x%W)+W)%W; s.y = ((s.y%H)+H)%H;
    // collisions with orbs
    for(let i=orbs.length-1;i>=0;i--){
      let o = orbs[i];
      let hx = s.headPos().x, hy = s.headPos().y;
      let d2 = (hx-o.x)*(hx-o.x)+(hy-o.y)*(hy-o.y);
      if(d2 < (s.size + o.r)*(s.size + o.r)){
        s.eatOrb(o);
        orbs.splice(i,1);
        // spawn new orb somewhere
        orbs.push(new Orb(rand(0,W), rand(0,H)));
      }
    }
  }
  // handle collisions: if player's head touches another snake segment -> die
  checkCollisions();
  // scoreboard
  updateLeaderboard();
}

function checkCollisions(){
  // simple collision: any head against other segments (except very near head segments to avoid self-collision)
  for(let i=0;i<snakes.length;i++){
    let a = snakes[i];
    if(a.dead) continue;
    let ah = a.headPos();
    for(let j=0;j<snakes.length;j++){
      if(i===j) continue;
      let b = snakes[j];
      for(let k=0;k<b.segments.length;k+=2){
        let seg = b.segments[k];
        if(!seg) continue;
        let dx = ah.x - seg.x, dy = ah.y - seg.y;
        let dist2 = dx*dx + dy*dy;
        let hitRadius = (a.size*0.9 + Math.max(4, b.size*(1 - k/b.segments.length*0.9)));
        if(dist2 < hitRadius*hitRadius){
          // 'a' dies and its segments turn into orbs
          a.dead = true;
          // spawn orbs from body
          for(let s of a.segments){
            orbs.push(new Orb(s.x + rand(-6,6), s.y + rand(-6,6), rand(2,6)));
          }
          // schedule respawn for bots only
          if(a !== player){
            setTimeout(()=>{ // respawn AI
              a.dead = false;
              a.x = rand(100,W-100); a.y = rand(100,H-100);
              a.segments = []; a.len = rand(20,80);
            }, 2000 + Math.random()*2000);
          } else {
            // player died -> respawn after short delay and keep leaderboard score
            setTimeout(()=>{ respawnPlayer(); }, 1200);
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
  player.x = W/2; player.y = H/2;
  player.segments = [];
  player.len = 40;
  player.speed = 1.9;
}

function draw(){
  // background gradient
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, '#07101a');
  g.addColorStop(1, '#081122');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // translate to simple camera (center on player)
  const camX = clamp(player.x - W/2, -W, W);
  const camY = clamp(player.y - H/2, -H, H);
  ctx.save();
  ctx.translate(-camX, -camY);

  // draw orbs
  for(let o of orbs) o.draw();
  // draw snakes sorted by length
  const sorted = snakes.slice().sort((a,b)=>a.len-b.len);
  for(let s of sorted) s.draw();

  ctx.restore();
}

function updateLeaderboard(){
  // top snakes by length
  const tops = snakes.filter(s=>!s.dead).slice().sort((a,b)=>b.len-a.len).slice(0,6);
  leadersEl.innerHTML = '';
  for(let s of tops){
    const li = document.createElement('li');
    li.textContent = `${s.name === 'You' ? (playerNameInput.value||'Player') : s.name} — ${Math.round(s.len)}`;
    leadersEl.appendChild(li);
  }
  scoreEl.textContent = Math.round(player.len);
}

// main loop
let last = performance.now();
function loop(t){
  const dt = t - last;
  last = t;
  update();
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// spawn more orbs occasionally
setInterval(()=>{ if(orbs.length < 240) orbs.push(new Orb(rand(0,W), rand(0,H))); }, 800);

// let user change player name
playerNameInput.addEventListener('input', ()=>{ player.name = playerNameInput.value || 'You'; });

// small helper for random
function rand(a,b){ return Math.random()*(b-a)+a; }
