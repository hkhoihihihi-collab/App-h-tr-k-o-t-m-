const API = "https://hk-key-manager.onrender.com/api/verify";
const keyInput = document.getElementById("keyInput");
const activateBtn = document.getElementById("activateBtn");
const demoBtn = document.getElementById("demoBtn");
const status = document.getElementById("status");
const panel = document.getElementById("panel");
const home = document.getElementById("home");
const toast = document.getElementById("toast");

function deviceId(){
  let id = localStorage.getItem("hk_device_id");
  if(!id){
    id = "web-" + crypto.randomUUID();
    localStorage.setItem("hk_device_id", id);
  }
  return id;
}

function beep(freq=520, duration=.07, type="sine"){
  try{
    const C = window.AudioContext || window.webkitAudioContext;
    if(!C) return;
    const ctx = new C();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.045, ctx.currentTime+.01);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime+duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime+duration+.02);
  }catch(e){}
}

function showToast(text){
  toast.textContent=text;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),1800);
}

activateBtn.addEventListener("click", async ()=>{
  beep(680,.08,"square");
  const key=keyInput.value.trim();
  if(!key){ status.textContent="VUI LÒNG NHẬP KEY"; beep(180,.12,"sawtooth"); return; }

  activateBtn.disabled=true;
  activateBtn.textContent="ĐANG KIỂM TRA...";
  status.textContent="ĐANG KẾT NỐI SERVER...";

  try{
    const r=await fetch(API,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({key,deviceId:deviceId()})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok || !data.valid){
      const msg={
        INVALID_KEY:"KEY SAI",
        KEY_EXPIRED:"KEY ĐÃ HẾT HẠN",
        KEY_DISABLED:"KEY ĐÃ BỊ KHÓA",
        DEVICE_MISMATCH:"KEY ĐÃ ĐƯỢC KÍCH HOẠT TRÊN THIẾT BỊ KHÁC",
        DEVICE_REQUIRED:"KHÔNG LẤY ĐƯỢC DEVICE ID"
      }[data.code] || "KHÔNG THỂ KÍCH HOẠT";
      status.textContent=msg;
      showToast(msg);
      beep(150,.16,"sawtooth");
      return;
    }

    localStorage.setItem("hk_key",key.toUpperCase());
    localStorage.setItem("hk_expires_at",data.expiresAt || "");
    status.textContent="KEY ĐÚNG — ĐÃ KÍCH HOẠT";
    showToast("KÍCH HOẠT THÀNH CÔNG");
    beep(740,.08); setTimeout(()=>beep(980,.12),90);
    setTimeout(()=>{
      panel.classList.add("hidden");
      home.classList.remove("hidden");
    },650);
  }catch(e){
    status.textContent="LỖI KẾT NỐI SERVER";
    showToast("KIỂM TRA KẾT NỐI");
    beep(150,.16,"sawtooth");
  }finally{
    activateBtn.disabled=false;
    activateBtn.textContent="KÍCH HOẠT";
  }
});

demoBtn.addEventListener("click",()=>{
  beep(430,.06);
  showToast("HIỆU ỨNG ĐANG HOẠT ĐỘNG");
});

document.querySelectorAll("button").forEach(b=>{
  b.addEventListener("click",()=>{ if(b!==activateBtn && b!==demoBtn) beep(560,.05); });
});

keyInput.addEventListener("keydown",e=>{
  if(e.key==="Enter") activateBtn.click();
});
