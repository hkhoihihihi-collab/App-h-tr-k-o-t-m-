const API="https://hk-key-manager.onrender.com/api/verify";
const keyInput=document.getElementById("keyInput");
const verifyBtn=document.getElementById("verifyBtn");
const status=document.getElementById("status");
const keyInfo=document.getElementById("keyInfo");

function getDeviceId(){
  let id=localStorage.getItem("hk_device_id");
  if(!id){id="web-"+crypto.randomUUID();localStorage.setItem("hk_device_id",id);}
  return id;
}
function beep(f=650,d=.08){
  try{
    const C=window.AudioContext||window.webkitAudioContext, c=new C();
    const o=c.createOscillator(),g=c.createGain();
    o.frequency.value=f;g.gain.value=.04;o.connect(g);g.connect(c.destination);
    o.start();o.stop(c.currentTime+d);
  }catch(e){}
}
verifyBtn.onclick=async()=>{
  beep();
  const key=keyInput.value.trim();
  keyInfo.classList.add("hidden");
  if(!key){status.textContent="VUI LÒNG NHẬP KEY";beep(180,.12);return;}
  verifyBtn.disabled=true;verifyBtn.textContent="ĐANG XÁC MINH...";status.textContent="ĐANG KẾT NỐI SERVER...";
  try{
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,deviceId:getDeviceId()})});
    const data=await r.json();
    if(!r.ok||!data.valid){status.textContent=({INVALID_KEY:"KEY SAI",KEY_EXPIRED:"KEY ĐÃ HẾT HẠN",KEY_DISABLED:"KEY ĐÃ BỊ KHÓA",DEVICE_MISMATCH:"KEY ĐÃ Ở THIẾT BỊ KHÁC"}[data.code]||data.message||"KEY KHÔNG HỢP LỆ");beep(150,.15);return;}
    status.textContent="KEY ĐÚNG — ĐÃ XÁC MINH";
    const hsd=data.expiresAt?new Date(data.expiresAt).toLocaleString("vi-VN"):"VĨNH VIỄN";
    keyInfo.innerHTML="<strong>HSD:</strong> "+hsd+"<br><strong>THIẾT BỊ:</strong> 1 THIẾT BỊ";
    keyInfo.classList.remove("hidden");beep(900,.12);
  }catch(e){status.textContent="LỖI KẾT NỐI SERVER";beep(150,.15);}
  finally{verifyBtn.disabled=false;verifyBtn.textContent="XÁC MINH KEY";}
};
keyInput.addEventListener("keydown",e=>{if(e.key==="Enter")verifyBtn.click();});