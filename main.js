const API = "https://hk-key-manager.onrender.com/api";

const features = [
  ["AIMLOCK", "BÁM ĐẦU NHẸ"],
  ["HEADLOCK", "GHIM NHẸ VÙNG ĐẦU"],
  ["NHẸ TÂM", "GIÚP TÂM NHẸ HƠN KHI KÉO"],
  ["FIX RUNG", "GIÚP TÂM ỔN ĐỊNH KHI KÉO"],
  ["FIX LỖ", "GIẢM HUỐT ĐẦU KHI KÉO"],
  ["TĂNG TỐC MÁY", "DỌN DẸP BỘ NHỚ GIẢI PHÓNG RAM"],
  ["TĂNG FPS", "GIÚP MÁY HOẠT ĐỘNG ỔN ĐỊNH"]
];

const box = document.getElementById("features");
const status = document.getElementById("status");

/* =========================
   ÂM THANH BẬT / TẮT
========================= */

function playSwitchSound(enabled) {
  try {
    const AudioCtx =
      window.AudioContext ||
      window.webkitAudioContext;

    const ctx = new AudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;

    osc.type = "sine";

    if (enabled) {
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.setValueAtTime(1250, now + 0.07);
      osc.frequency.setValueAtTime(1550, now + 0.14);
    } else {
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.setValueAtTime(480, now + 0.08);
    }

    gain.gain.setValueAtTime(0.0001, now);

    gain.gain.exponentialRampToValueAtTime(
      0.10,
      now + 0.012
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.28
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);
  } catch (e) {}
}

/* =========================
   TẠO 7 NÚT
========================= */

features.forEach(([name, description]) => {
  const row = document.createElement("div");

  row.className = "row";

  row.innerHTML = `
    <div>
      <div class="name">${name}</div>
      <span class="desc">${description}</span>
    </div>

    <button
      class="switch"
      type="button"
      aria-pressed="false"
    >
      <div class="knob"></div>
    </button>
  `;

  const switchBtn =
    row.querySelector(".switch");

  switchBtn.addEventListener(
    "click",
    () => {
      const enabled =
        !switchBtn.classList.contains("on");

      switchBtn.classList.toggle(
        "on",
        enabled
      );

      switchBtn.setAttribute(
        "aria-pressed",
        String(enabled)
      );

      playSwitchSound(enabled);
    }
  );

  box.appendChild(row);
});

/* =========================
   KIỂM TRA SESSION
========================= */

async function verifySession() {
  const token =
    localStorage.getItem("hk_session");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    const response =
      await fetch(
        API + "/session",
        {
          method: "POST",
          headers: {
            "Authorization":
              "Bearer " + token
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        "SESSION_INVALID"
      );
    }

    status.textContent =
      "Session hợp lệ.";
  } catch (error) {
    sessionStorage.removeItem(
      "hk_session"
    );

    window.location.href =
      "index.html";
  }
}

verifySession();

/* =========================
   MỞ FREE FIRE THƯỜNG
========================= */

document
  .getElementById("ffth")
  .addEventListener(
    "click",
    () => {
      window.location.href =
        "freefireth://";
    }
  );

/* =========================
   MỞ FREE FIRE MAX
========================= */

document
  .getElementById("ffmax")
  .addEventListener(
    "click",
    () => {
      window.location.href =
        "freefiremax://";
    }
  );
