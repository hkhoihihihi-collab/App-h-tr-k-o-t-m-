const API="https://hk-key-manager.onrender.com/api";
const input=document.getElementById("keyInput");
const activate=document.getElementById("activate");
const status=document.getElementById("status");

function deviceId(){
  let id=localStorage.getItem("hk_device_id");
  if(!id){
    id="HKD-"+crypto.randomUUID().replaceAll("-","").slice(0,12).toUpperCase();
    localStorage.setItem("hk_device_id",id);
  }
  return id;
}
function tone(type){
  try{
    const C=window.AudioContext||window.webkitAudioContext, c=new C();
    const o=c.createOscillator(),g=c.createGain(),now=c.currentTime;
    o.type="sine";
    const seq=type==="on"?[880,1175,1480]:[740,587];
    seq.forEach((f,i)=>o.frequency.setValueAtTime(f,now+i*.07));
    g.gain.setValueAtTime(.0001,now);
    g.gain.exponentialRampToValueAtTime(.09,now+.01);
    g.gain.exponentialRampToValueAtTime(.0001,now+seq.length*.07+.12);
    o.connect(g);g.connect(c.destination);o.start();o.stop(now+seq.length*.07+.15);
  }catch(e){}
}
activate.addEventListener("click",async()=>{
  const key=input.value.trim().toUpperCase();
  if(!key){status.textContent="Chưa nhập key.";tone("off");return}
  activate.disabled=true;status.textContent="Đang xác thực...";
  try{
    const r=await fetch(API+"/activate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,deviceId:deviceId()})});
    const d=await r.json();
    if(!r.ok||!d.valid||!d.sessionToken) throw new Error(d.message||"Key không hợp lệ");
    sessionStorage.setItem("hk_session",d.sessionToken);
    tone("on");status.textContent="Thành công. Đang mở app...";
    setTimeout(()=>location.href="main.html",450);
  }catch(e){
    status.textContent=e.message||"Không thể kết nối máy chủ.";
    tone("off");
  }finally{activate.disabled=false}
});
