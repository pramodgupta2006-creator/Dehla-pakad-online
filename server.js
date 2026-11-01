const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const rooms = new Map();
const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

function code() { return crypto.randomBytes(3).toString("hex").toUpperCase(); }
function shuffledDeck() {
  const deck = [];
  for (let s=0;s<4;s++) for (let r=0;r<13;r++) deck.push({s,r});
  for (let i=deck.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return deck;
}
function publicState(room) {
  return {
    code: room.code,
    players: room.players.map(p => p ? {name:p.name, connected:!!p.socketId} : null),
    started: room.started,
    trump: room.trump,
    turn: room.turn,
    trick: room.trick,
    trickNumber: room.tricks.length + 1,
    scores: room.scores,
    lastTrick: room.lastTrick,
    finished: room.finished,
    winner: room.winner
  };
}
function sendState(room) {
  room.players.forEach((p,i) => {
    if (!p || !p.socketId) return;
    io.to(p.socketId).emit("state", {...publicState(room), yourSeat:i, hand:room.started ? room.hands[i] : []});
  });
}
function roomFor(socket) {
  const code = socket.data.room;
  return code && rooms.get(code);
}
function startGame(room) {
  const deck=shuffledDeck();
  room.hands=[0,1,2,3].map(i=>deck.slice(i*13,(i+1)*13).sort((a,b)=>a.s-b.s||a.r-b.r));
  room.trump=Math.floor(Math.random()*4);
  room.trick=[]; room.tricks=[]; room.lastTrick=null;
  room.scores=[0,0]; room.turn=0; room.started=true;
  room.finished=false; room.winner=null;
}
function cardName(c) { return ranks[c.r]+suits[c.s]; }
function validPlay(hand, card, trick) {
  if (!trick.length) return true;
  const leadSuit=trick[0].card.s;
  return card.s===leadSuit || !hand.some(c=>c.s===leadSuit);
}
function trickWinner(trick, trump) {
  let best=trick[0];
  for (const play of trick.slice(1)) {
    const a=play.card, b=best.card;
    if ((a.s===trump && b.s!==trump) ||
        (a.s===b.s && a.r>b.r)) best=play;
  }
  return best;
}
io.on("connection", socket => {
  socket.on("createRoom", ({name}) => {
    let roomCode; do { roomCode=code(); } while(rooms.has(roomCode));
    const room={code:roomCode,players:[{name:(name||"Player 1").slice(0,18),socketId:socket.id},null,null,null],
      started:false,hands:[],trump:null,trick:[],tricks:[],lastTrick:null,scores:[0,0],turn:0,finished:false,winner:null};
    rooms.set(roomCode,room); socket.data.room=roomCode; socket.data.seat=0;
    socket.emit("joined",{code:roomCode,seat:0}); sendState(room);
  });
  socket.on("joinRoom", ({code:raw,name}) => {
    const c=String(raw||"").trim().toUpperCase(), room=rooms.get(c);
    if (!room) return socket.emit("errorMessage","Room not found. Check the code.");
    if (room.started) return socket.emit("errorMessage","This game has already started.");
    const seat=room.players.findIndex(p=>!p);
    if (seat<0) return socket.emit("errorMessage","This room is full.");
    room.players[seat]={name:(name||`Player ${seat+1}`).slice(0,18),socketId:socket.id};
    socket.data.room=c; socket.data.seat=seat;
    socket.emit("joined",{code:c,seat}); sendState(room);
  });
  socket.on("startGame", () => {
    const room=roomFor(socket);
    if (!room) return;
    if (socket.data.seat!==0) return socket.emit("errorMessage","Only the room creator can start.");
    if (room.players.some(p=>!p)) return socket.emit("errorMessage","Waiting for all 4 players.");
    if (room.started) return;
    startGame(room); sendState(room);
  });
  socket.on("playCard", ({index}) => {
    const room=roomFor(socket), seat=socket.data.seat;
    if (!room || !room.started || room.finished || seat!==room.turn) return;
    const hand=room.hands[seat], card=hand[index];
    if (!card) return;
    if (!validPlay(hand,card,room.trick)) return socket.emit("errorMessage","You must follow the suit led if you can.");
    hand.splice(index,1);
    room.trick.push({seat,card});
    if (room.trick.length===4) {
      const win=trickWinner(room.trick,room.trump);
      const tens=room.trick.filter(p=>p.card.r===8).length;
      room.scores[win.seat%2]+=tens;
      room.lastTrick={plays:room.trick,winner:win.seat,tens};
      room.tricks.push(room.trick);
      room.trick=[];
      room.turn=win.seat;
      if (room.tricks.length===13) {
        room.finished=true;
        room.winner=room.scores[0]===room.scores[1] ? "Tie" :
          room.scores[0]>room.scores[1] ? "Team A (Players 1 & 3)" : "Team B (Players 2 & 4)";
      }
    } else {
      room.turn=(room.turn+1)%4;
    }
    sendState(room);
  });
  socket.on("disconnect", () => {
    const room=roomFor(socket); if (!room) return;
    const seat=socket.data.seat;
    if (room.players[seat]) room.players[seat].socketId=null;
    sendState(room);
    if (room.players.every(p=>!p || !p.socketId)) rooms.delete(room.code);
  });
});
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Dehla Pakad running on port ${PORT}`));
