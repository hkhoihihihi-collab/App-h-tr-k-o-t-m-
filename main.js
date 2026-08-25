const API="https://hk-key-manager.onrender.com/api";

const features=[
["AIMLOCK","BÁM ĐẦU NHẸ"],
["HEADLOCK","GHIM NHẸ VÙNG ĐẦU"],
["NHẸ TÂM","GIÚP TÂM NHẸ HƠN KHI KÉO"],
["FIX RUNG","GIÚP TÂM ỔN ĐỊNH KHI KÉO"],
["FIX LỖ","GIẢM HUỐT ĐẦU KHI KÉO"],
["TĂNG TỐC MÁY","DỌN DẸP BỘ NHỚ GIẢI PHÓNG RAM"],
["TĂNG FPS","GIÚP MÁY HOẠT ĐỘNG ỔN ĐỊNH"]
];

const box=document.getElementById("features");
const status=document.getElementById("status");

function playSwitchSound(enabled){
try{
const AudioCtx=window.AudioContext||window.webkitAudioContext;
const ctx=new AudioCtx(),osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
osc.type="sine";
if(enabled){
osc.frequency.setValueAtTime(900,now);
osc.frequency.setValueAtTime(1250,now+.07);
osc.frequency.setValueAtTime(1550,now+.14);
}else{
osc.frequency.setValueAtTime(650,now);
osc.frequency.setValueAtTime(480,now+.08);
}
gain.gain.setValueAtTime(.0001,now);
gain.gain.exponentialRampToValueAtTime(.10,now+.012);
gain.gain.exponentialRampToValueAtTime(.0001,now+.28);
osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.32);
}catch(_){}
}

features.forEach(([name,description],i)=>{
const row=document.createElement("div");
row.className="row";
row.style.animationDelay=(.12+i*.06)+"s";
row.innerHTML=`<div><div class="name">${name}</div><span class="desc">${description}</span></div><button class="switch" type="button" aria-pressed="false"><div class="knob"></div></button>`;
const sw=row.querySelector(".switch");
sw.addEventListener("click",()=>{
const enabled=!sw.classList.contains("on");
sw.classList.toggle("on",enabled);
sw.setAttribute("aria-pressed",String(enabled));
playSwitchSound(enabled);
});
box.appendChild(row);
});

/*
SESSION:
Giữ sessionStorage đúng với trang kích hoạt.
Không xóa token chỉ vì lỗi mạng/Render tạm thời.
Chỉ quay về index khi server xác nhận session không hợp lệ.
*/
async function verifySession(){
const token=sessionStorage.getItem("hk_session");
if(!token){window.location.replace("index.html");return;}

try{
const response=await fetch(API+"/session",{
method:"POST",
headers:{"Authorization":"Bearer "+token}
});
let data={};
try{data=await response.json();}catch(_){}
if(response.status===401||response.status===403||data.valid===false){
sessionStorage.removeItem("hk_session");
window.location.replace("index.html");
return;
}
if(response.ok&&data.valid){
status.textContent="Session hợp lệ.";
return;
}
status.textContent="Đang chờ máy chủ xác thực...";
}catch(_){
status.textContent="Session đang được giữ. Không thể kiểm tra máy chủ lúc này.";
}
}

verifySession();

document.getElementById("ffth").addEventListener("click",()=>{
window.location.href="freefireth://";
});
document.getElementById("ffmax").addEventListener("click",()=>{
window.location.href="freefiremax://";
});
