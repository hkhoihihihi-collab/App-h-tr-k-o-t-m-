const API = "https://hk-key-manager.onrender.com/api";

const keyInput = document.getElementById("keyInput");
const checkBtn = document.getElementById("checkBtn");
const activateBtn = document.getElementById("activateBtn");
const pasteBtn = document.getElementById("pasteBtn");
const clearBtn = document.getElementById("clearBtn");
const contactBtn = document.getElementById("contactBtn");
const result = document.getElementById("result");
const statusTitle = document.getElementById("statusTitle");
const statusDetail = document.getElementById("statusDetail");
const keyDetails = document.getElementById("keyDetails");
const keyState = document.getElementById("keyState");
const expiry = document.getElementById("expiry");
const deviceState = document.getElementById("deviceState");

function beep(freq=650, duration=.07){
  try{
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = .035;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }catch(e){}
}

function getDeviceId(){
  let id = localStorage.getItem("hk_device_id");
  if(!id){
    id = "HKD-" + crypto.randomUUID().replaceAll("-","").slice(0,12).toUpperCase();
    localStorage.setItem("hk_device_id", id);
  }
  return id;
}


function formatExpiry(value){
  if(value === null || value === undefined || value === ""){
    return "VĨNH VIỄN";
  }
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return "KHÔNG XÁC ĐỊNH";
  return d.toLocaleString("vi-VN");
}

function setStatus(title, detail, type=""){
  result.classList.remove("success","error");
  if(type) result.classList.add(type);
  statusTitle.textContent = title;
  statusDetail.textContent = detail;
}

function showDetails(data, stateText){
  keyDetails.classList.remove("hidden");
  keyState.textContent = stateText;
  expiry.textContent = formatExpiry(data.expiresAt);
  deviceState.textContent = data.deviceBound
    ? "ĐÃ GẮN 1 THIẾT BỊ"
    : "1 THIẾT BỊ";
}

function errorText(code, fallback){
  const map = {
    INVALID_KEY: "KEY KHÔNG TỒN TẠI",
    KEY_DISABLED: "KEY ĐÃ BỊ KHÓA",
    KEY_EXPIRED: "KEY ĐÃ HẾT HẠN",
    DEVICE_MISMATCH: "KEY ĐÃ GẮN THIẾT BỊ KHÁC",
    KEY_REQUIRED: "CHƯA NHẬP KEY",
    DEVICE_REQUIRED: "THIẾU MÃ THIẾT BỊ"
  };
  return map[code] || fallback || "KEY KHÔNG HỢP LỆ";
}

async function api(path, body){
  const response = await fetch(API + path, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  let data = {};
  try{ data = await response.json(); }catch(e){}
  return {response, data};
}

function validateInput(){
  const key = keyInput.value.trim().toUpperCase();
  if(!key){
    setStatus("CHƯA NHẬP KEY","Nhập mã HK-XXXX-XXXX-XXXX trước.","error");
    beep(180,.12);
    return null;
  }
  return key;
}

/* Chỉ KIỂM TRA: không bind device */
checkBtn.addEventListener("click", async ()=>{
  beep();
  const key = validateInput();
  if(!key) return;

  checkBtn.disabled = true;
  activateBtn.disabled = true;
  keyDetails.classList.add("hidden");
  setStatus("ĐANG KIỂM TRA KEY","Đang kiểm tra trạng thái và HSD...");

  try{
    const {response,data} = await api("/check", {
      key,
      deviceId:getDeviceId()
    });

    if(!response.ok || !data.valid){
      setStatus(errorText(data.code,data.message),"Key không thể sử dụng.", "error");
      beep(150,.14);
      return;
    }

    if(data.deviceId && data.deviceId !== getDeviceId()){
      setStatus("KEY ĐÃ GẮN THIẾT BỊ KHÁC","Không thể kích hoạt trên thiết bị này.","error");
      beep(150,.14);
      return;
    }

    const state = data.deviceBound ? "ĐÃ KÍCH HOẠT" : "CÒN KHẢ DỤNG";
    showDetails(data,state);
    setStatus("KEY HỢP LỆ","Key còn sử dụng được. Hãy bấm Kích hoạt nếu đây là thiết bị của bạn.","success");
    beep(820,.08);
    setTimeout(()=>beep(1040,.09),80);
  }catch(e){
    setStatus("LỖI KẾT NỐI","Không thể kết nối máy chủ Render.","error");
    beep(150,.14);
  }finally{
    checkBtn.disabled = false;
    activateBtn.disabled = false;
  }
});

/* KÍCH HOẠT: mới bind device */
activateBtn.addEventListener("click", async ()=>{
  beep();
  const key = validateInput();
  if(!key) return;

  checkBtn.disabled = true;
  activateBtn.disabled = true;
  setStatus("ĐANG KÍCH HOẠT","Đang gắn key với thiết bị này...");

  try{
    const {response,data} = await api("/activate", {
      key,
      deviceId:getDeviceId()
    });

    if(!response.ok || !data.valid){
      setStatus(errorText(data.code,data.message),"Thiết bị này không được phép sử dụng key.","error");
      beep(150,.14);
      return;
    }

    showDetails(data,"ĐÃ KÍCH HOẠT");
    setStatus("KÍCH HOẠT THÀNH CÔNG","Key đã được gắn với thiết bị này.","success");
    beep(900,.08);
    setTimeout(()=>beep(1150,.1),90);

    /* Chỗ này sau sẽ chuyển sang APP CHÍNH */
    // window.location.href = "main.html";
  }catch(e){
    setStatus("LỖI KẾT NỐI","Không thể kết nối máy chủ Render.","error");
    beep(150,.14);
  }finally{
    checkBtn.disabled = false;
    activateBtn.disabled = false;
  }
});

pasteBtn.addEventListener("click", async ()=>{
  beep(560);
  try{
    keyInput.value = (await navigator.clipboard.readText()).trim().toUpperCase();
    setStatus("ĐÃ DÁN KEY","Bấm Kiểm tra key để xem HSD.","");
  }catch(e){
    setStatus("KHÔNG THỂ DÁN","Trình duyệt không cho phép truy cập clipboard.","error");
  }
});

clearBtn.addEventListener("click", ()=>{
  beep(420);
  keyInput.value = "";
  keyDetails.classList.add("hidden");
  setStatus("Sẵn sàng.","Chưa Kích Hoạt");
  keyInput.focus();
});





keyInput.addEventListener("input", ()=>{
  keyInput.value = keyInput.value.toUpperCase();
});

keyInput.addEventListener("keydown", e=>{
  if(e.key === "Enter") checkBtn.click();
});
