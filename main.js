const API="https://hk-key-manager.onrender.com/api";
const features=[
 ["AIMLOCK","AimHelpService.json"],
 ["HEADLOCK","HeadLock.cpp"],
 ["NHẸ TÂM","Nhetam.cpp"],
 ["FIX RUNG","Fix Rung.cpp"],
 ["FIX LỖ","AimlockConfig"],
 ["TĂNG TỐC MÁY","AimLock toiuiu.cpp"],
 ["TĂNG FPS","Tối Ưu.cpp"]
];
const box=document.getElementById("features"),status=document.getElementById("status");
function sound(on){
 try{
  const C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain(),n=c.currentTime;
  o.type="sine";
  if(on){o.frequency.setValueAtTime(900,n);o.frequency.setValueAtTime(1250,n+.07);o.frequency.setValueAtTime(1550,n+.14)}
  else{o.frequency.setValueAtTime(650,n);o.frequency.setValueAtTime(480,n+.08)}
  g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.10,n+.012);g.gain.exponentialRampToValueAtTime(.0001,n+.28);
  o.connect(g);g.connect(c.destination);o.start();o.stop(n+.32);
 }catch(e){}
}
features.forEach(([name,file])=>{
 const row=document.createElement("div");row.className="row";
 row.innerHTML=`<div><div class="name">${name}</div><span class="file">${file}</span></div><button class="switch" aria-pressed="false"><div class="knob"></div></button>`;
 const sw=row.querySelector(".switch");
 sw.addEventListener("click",()=>{const on=!sw.classList.contains("on");sw.classList.toggle("on",on);sw.setAttribute("aria-pressed",String(on));sound(on)});
 box.appendChild(row);
});
async function verify(){
 const token=sessionStorage.getItem("hk_session");
 if(!token){location.href="index.html";return}
 try{
  const r=await fetch(API+"/session",{method:"POST",headers:{Authorization:"Bearer "+token}});
  if(!r.ok) throw new Error();
  status.textContent="Session hợp lệ.";
 }catch(e){sessionStorage.removeItem("hk_session");location.href="index.html"}
}
verify();

document.getElementById("ffth").onclick=()=>location.href="freefireth://";
document.getElementById("ffmax").onclick=()=>location.href="freefiremax://";
