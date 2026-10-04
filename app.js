import { firebaseConfig } from "./firebase-config.js";

let db = null, firebaseReady = false;
try {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js");
  const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, onSnapshot, serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
  if (!firebaseConfig.apiKey.startsWith("YOUR_")) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app); firebaseReady = true;
    window.FB={collection,addDoc,getDocs,query,orderBy,limit,onSnapshot,serverTimestamp};
    document.querySelector("#connection").textContent="Firebase接続";
  }
} catch(e){ console.warn(e); }

const $=s=>document.querySelector(s);
let currentSet=[], currentIndex=0, correct=0, strokes=[], currentSessionId=localStorage.getItem("factorSession")||"local";
let localSets=JSON.parse(localStorage.getItem("factorSets")||"[]");
let localResults=JSON.parse(localStorage.getItem("factorResults")||"[]");

function factorProblem(diff){
  let a,b;
  if(diff==="easy"){a=rand(1,6);b=rand(1,6)}
  else if(diff==="mid"){a=rand(2,9);b=rand(2,9)}
  else {a=rand(1,10);b=rand(1,10)}
  const s=a+b,p=a*b;
  return {problem:`x² + ${s}x + ${p}`,answer:`(x+${a})(x+${b})`, factors:[a,b]};
}
function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function normalize(s){return s.replace(/[Ａ-Ｚａ-ｚ０-９＋－（）]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/\s/g,"").replace(/×/g,"*").replace(/−/g,"-").toLowerCase();}
function parseFactors(s){
  s=normalize(s).replace(/^\+?/,"");
  const m=s.match(/^\(?x([+-]\d+)\)?\*?\(?x([+-]\d+)\)?$/);
  if(m)return [Number(m[1]),Number(m[2])].sort((a,b)=>a-b);
  const m2=s.match(/^\(x([+-]\d+)\)\(x([+-]\d+)\)$/);
  if(m2)return [Number(m2[1]),Number(m2[2])].sort((a,b)=>a-b);
  return null;
}
function isEquivalent(answer, expected){
  const a=parseFactors(answer), e=parseFactors(expected);
  return !!a&&!!e&&a[0]===e[0]&&a[1]===e[1];
}
function renderList(){
  $("#questionList").innerHTML=currentSet.map((q,i)=>`
  <div class="question"><input data-i="${i}" data-k="problem" value="${q.problem}">
  <input data-i="${i}" data-k="answer" value="${q.answer}">
  <button data-del="${i}">削除</button></div>`).join("");
  $("#questionList").querySelectorAll("input").forEach(el=>el.onchange=()=>currentSet[el.dataset.i][el.dataset.k]=el.value);
  $("#questionList").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{currentSet.splice(+b.dataset.del,1);renderList()});
}
$("#generate").onclick=()=>{
 currentSet=Array.from({length:+$("#count").value},()=>factorProblem($("#difficulty").value));
 $("#manual").value=currentSet.map(q=>`${q.problem} | ${q.answer}`).join("\n"); renderList();
};
$("#applyManual").onclick=()=>{
 currentSet=$("#manual").value.split("\n").map(x=>x.split("|")).filter(x=>x.length>=2&&x[0].trim()).map(x=>({problem:x[0].trim(),answer:x[1].trim()}));
 renderList();
};
$("#saveSet").onclick=async()=>{
 const set={name:$("#setName").value,questions:currentSet,createdAt:new Date().toISOString()};
 localSets.unshift(set); localStorage.setItem("factorSets",JSON.stringify(localSets)); renderSaved();
 if(firebaseReady) await window.FB.addDoc(window.FB.collection(db,"questionSets"),set);
 alert("問題セットを保存しました。");
};
$("#publish").onclick=()=>{
 if(!currentSet.length){alert("先に問題セットを作成してください。");return}
 localStorage.setItem("publishedSet",JSON.stringify(currentSet));
 currentIndex=0;correct=0;showStudent();renderStudent();
};
function renderSaved(){
 $("#savedSets").innerHTML=localSets.length?localSets.map((s,i)=>`<div class="set"><span>${s.name}（${s.questions.length}問）</span><button data-load="${i}">読み込む</button></div>`).join(""):"まだありません";
 $("#savedSets").querySelectorAll("[data-load]").forEach(b=>b.onclick=()=>{currentSet=structuredClone(localSets[+b.dataset.load].questions);$("#setName").value=localSets[+b.dataset.load].name;$("#manual").value=currentSet.map(q=>`${q.problem} | ${q.answer}`).join("\n");renderList()});
}
function showStudent(){document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));$("#student").classList.add("active")}
function renderStudent(){
 if(!currentSet.length){$("#problem").textContent="問題がありません";return}
 $("#progress").textContent=`問題 ${currentIndex+1} / ${currentSet.length}`;
 $("#score").textContent=`正解 ${correct}`;
 $("#problem").textContent=currentSet[currentIndex].problem;
 $("#recognized").value="";$("#feedback").textContent="";clearPad();
}
$("#grade").onclick=()=>{
 if(!currentSet.length)return;
 const ans=$("#recognized").value.trim();
 const ok=isEquivalent(ans,currentSet[currentIndex].answer);
 if(ok) correct++;
 $("#feedback").textContent=ok?"○ 正解です。":"× 不正解です。正解："+currentSet[currentIndex].answer;
 saveResult({student:$("#studentName").value,question:currentSet[currentIndex].problem,answer:ans,correct:ok,strokes:strokes.length,timestamp:new Date().toISOString()});
 if(currentIndex<currentSet.length-1){currentIndex++;setTimeout(renderStudent,700)}else{setTimeout(()=>{$("#feedback").textContent=`終了。${currentSet.length}問中 ${correct}問正解（${Math.round(correct/currentSet.length*100)}%）`;renderResults()},700)}
};
function saveResult(r){localResults.unshift(r);localStorage.setItem("factorResults",JSON.stringify(localResults));if(firebaseReady)window.FB.addDoc(window.FB.collection(db,"answers"),r).catch(console.warn)}
function renderResults(){
 $("#results").innerHTML=localResults.slice(0,100).map(r=>`<tr><td>${esc(r.student)}</td><td>${esc(r.question)}</td><td>${r.correct?"○":"×"}</td><td>${r.strokes}画</td><td>${new Date(r.timestamp).toLocaleString()}</td></tr>`).join("");
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

// 手書きキャンバス
const canvas=$("#pad"),ctx=canvas.getContext("2d");
function pos(e){const r=canvas.getBoundingClientRect();const p=e.touches?.[0]||e;return{x:(p.clientX-r.left)*canvas.width/r.width,y:(p.clientY-r.top)*canvas.height/r.height}}
let drawing=false,last=null;
function start(e){e.preventDefault();drawing=true;last=pos(e);strokes.push([]);strokes.at(-1).push(last)}
function move(e){if(!drawing)return;e.preventDefault();const p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.lineWidth=5;ctx.lineCap="round";ctx.stroke();last=p;strokes.at(-1).push(p)}
function end(){drawing=false}
canvas.addEventListener("pointerdown",start);canvas.addEventListener("pointermove",move);window.addEventListener("pointerup",end);
$("#clear").onclick=clearPad;
$("#undo").onclick=()=>{strokes.pop();redraw()};
function clearPad(){strokes=[];redraw()}
function redraw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle="#111";ctx.lineWidth=5;ctx.lineCap="round";for(const s of strokes){for(let i=1;i<s.length;i++){ctx.beginPath();ctx.moveTo(s[i-1].x,s[i-1].y);ctx.lineTo(s[i].x,s[i].y);ctx.stroke()}}}

document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));$("#"+b.dataset.tab).classList.add("active");if(b.dataset.tab==="dashboard")renderResults()});
$("#refresh").onclick=renderResults;
renderSaved();renderResults();redraw();

// 初回は保存済み公開セットを読む
try{currentSet=JSON.parse(localStorage.getItem("publishedSet")||"[]");if(currentSet.length)renderStudent()}catch{}
