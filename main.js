const API =
  "https://hk-key-manager.onrender.com/api";

const features = [
  ["AIMLOCK", "BÁM ĐẦU NHẸ"],
  ["HEADLOCK", "GHIM NHẸ VÙNG ĐẦU"],
  ["NHẸ TÂM", "GIÚP TÂM NHẸ HƠN KHI KÉO"],
  ["FIX RUNG", "GIÚP TÂM ỔN ĐỊNH KHI KÉO"],
  ["FIX LỖ", "GIẢM HUỐT ĐẦU KHI KÉO"],
  ["TĂNG TỐC MÁY", "DỌN DẸP BỘ NHỚ GIẢI PHÓNG RAM"],
  ["TĂNG FPS", "GIÚP MÁY HOẠT ĐỘNG ỔN ĐỊNH"]
];

const box =
  document.getElementById("features");

const status =
  document.getElementById("status");

/* =========================
   ÂM THANH BẬT / TẮT
========================= */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx =
      new (window.AudioContext ||
        window.webkitAudioContext)();
  }

  if (
    audioCtx.state === "suspended"
  ) {
    audioCtx.resume();
  }

  return audioCtx;
}

function playSwitchSound(enabled) {
  try {
    const ctx =
      getAudioContext();

    const osc =
      ctx.createOscillator();

    const gain =
      ctx.createGain();

    const now =
      ctx.currentTime;

    osc.type = "sine";

    if (enabled) {
      osc.frequency.setValueAtTime(
        900,
        now
      );

      osc.frequency.setValueAtTime(
        1250,
        now + 0.07
      );

      osc.frequency.setValueAtTime(
        1550,
        now + 0.14
      );
    } else {
      osc.frequency.setValueAtTime(
        650,
        now
      );

      osc.frequency.setValueAtTime(
        480,
        now + 0.08
      );
    }

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

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

    osc.stop(
      now + 0.32
    );
  } catch (_) {}
}

/* =========================
   TẠO 7 NÚT
========================= */

if (box) {
  features.forEach(
    ([name, description]) => {
      const row =
        document.createElement(
          "div"
        );

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
        row.querySelector(
          ".switch"
        );

      switchBtn.addEventListener(
        "click",
        () => {
          const enabled =
            !switchBtn.classList.contains(
              "on"
            );

          switchBtn.classList.toggle(
            "on",
            enabled
          );

          switchBtn.setAttribute(
            "aria-pressed",
            String(enabled)
          );

          playSwitchSound(
            enabled
          );
        }
      );

      box.appendChild(row);
    }
  );
}

/* =========================
   SESSION
========================= */

function getSession() {
  try {
    return localStorage.getItem(
      "hk_session"
    );
  } catch (_) {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(
      "hk_session"
    );
  } catch (_) {}
}

/* =========================
   KIỂM TRA SESSION
========================= */

async function verifySession() {
  const token =
    getSession();

  /*
   * Không có session
   * => quay về app Key
   */

  if (!token) {
    if (status) {
      status.textContent =
        "Chưa có session.";
    }

    window.location.replace(
      "index.html"
    );

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
          },

          cache: "no-store"
        }
      );

    let data = {};

    try {
      data =
        await response.json();
    } catch (_) {}

    /*
     * Chỉ xóa session khi
     * server thực sự xác nhận
     * session không hợp lệ.
     */

    if (
      !response.ok ||
      !data.valid
    ) {
      clearSession();

      if (status) {
        status.textContent =
          "Session không hợp lệ.";
      }

      window.location.replace(
        "index.html"
      );

      return;
    }

    /*
     * Session hợp lệ.
     */

    if (status) {
      status.textContent =
        "Session hợp lệ.";
    }

  } catch (error) {
    /*
     * QUAN TRỌNG:
     *
     * Nếu mạng/Render tạm thời lỗi,
     * KHÔNG tự xóa session.
     *
     * Như vậy app không bị đá
     * về trang Key chỉ vì lỗi mạng.
     */

    if (status) {
      status.textContent =
        "Đã xác thực session.";
    }

    console.error(
      "Session check error:",
      error
    );
  }
}

/*
 * Kiểm tra session trước khi
 * cho phép thao tác app.
 */

verifySession();

/* =========================
   MỞ FREE FIRE THƯỜNG
========================= */

const ffth =
  document.getElementById(
    "ffth"
  );

if (ffth) {
  ffth.addEventListener(
    "click",
    () => {
      window.location.href =
        "freefireth://";
    }
  );
}

/* =========================
   MỞ FREE FIRE MAX
========================= */

const ffmax =
  document.getElementById(
    "ffmax"
  );

if (ffmax) {
  ffmax.addEventListener(
    "click",
    () => {
      window.location.href =
        "freefiremax://";
    }
  );
        }
