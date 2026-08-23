/* =========================
   PHONE-LIKE UI SOUNDS
========================= */

let hkAudioCtx = null;

function hkAudio() {
  if (!hkAudioCtx) {
    hkAudioCtx =
      new (window.AudioContext ||
        window.webkitAudioContext)();
  }

  if (hkAudioCtx.state === "suspended") {
    hkAudioCtx.resume();
  }

  return hkAudioCtx;
}

function hkTone(
  freq,
  duration = 0.12,
  delay = 0,
  volume = 0.055
) {
  const ctx = hkAudio();
  const now = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);

  gain.gain.exponentialRampToValueAtTime(
    volume,
    now + 0.012
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function hkSound(type) {
  try {
    if (type === "click") {
      hkTone(880, 0.075, 0, 0.055);
      hkTone(1175, 0.095, 0.055, 0.055);
    }

    if (type === "success") {
      hkTone(784, 0.10, 0, 0.06);
      hkTone(988, 0.10, 0.085, 0.06);
      hkTone(1175, 0.16, 0.17, 0.065);
    }

    if (type === "error") {
      hkTone(440, 0.12, 0, 0.06);
      hkTone(330, 0.16, 0.10, 0.06);
    }

    if (type === "activate") {
      hkTone(659, 0.10, 0, 0.06);
      hkTone(784, 0.10, 0.09, 0.06);
      hkTone(988, 0.13, 0.18, 0.065);
    }
  } catch (_) {}
}

/* =========================
   API
========================= */

const API =
  "https://hk-key-manager.onrender.com/api";

/* =========================
   ELEMENTS
========================= */

const keyInput =
  document.getElementById("keyInput");

const checkBtn =
  document.getElementById("checkBtn");

const activateBtn =
  document.getElementById("activateBtn");

const pasteBtn =
  document.getElementById("pasteBtn");

const clearBtn =
  document.getElementById("clearBtn");

const contactBtn =
  document.getElementById("contactBtn");

const result =
  document.getElementById("result");

const statusTitle =
  document.getElementById("statusTitle");

const statusDetail =
  document.getElementById("statusDetail");

const keyDetails =
  document.getElementById("keyDetails");

const keyState =
  document.getElementById("keyState");

const expiry =
  document.getElementById("expiry");

const deviceState =
  document.getElementById("deviceState");

/* =========================
   SIMPLE BEEP
========================= */

function beep(
  freq = 650,
  duration = 0.07
) {
  try {
    const AudioCtx =
      window.AudioContext ||
      window.webkitAudioContext;

    const ctx = new AudioCtx();

    const osc =
      ctx.createOscillator();

    const gain =
      ctx.createGain();

    osc.frequency.value = freq;
    gain.gain.value = 0.04;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    osc.stop(
      ctx.currentTime + duration
    );
  } catch (_) {}
}

/* =========================
   DEVICE ID
========================= */

function getDeviceId() {
  let id =
    localStorage.getItem(
      "hk_device_id"
    );

  if (!id) {
    if (
      typeof crypto !== "undefined" &&
      crypto.randomUUID
    ) {
      id =
        "HKD-" +
        crypto
          .randomUUID()
          .replaceAll("-", "")
          .slice(0, 12)
          .toUpperCase();
    } else {
      id =
        "HKD-" +
        Math.random()
          .toString(36)
          .substring(2, 14)
          .toUpperCase();
    }

    localStorage.setItem(
      "hk_device_id",
      id
    );
  }

  return id;
}

/* =========================
   SESSION
========================= */

function saveSession(token) {
  if (!token) return false;

  try {
    localStorage.setItem(
      "hk_session",
      token
    );

    return (
      localStorage.getItem(
        "hk_session"
      ) === token
    );
  } catch (_) {
    return false;
  }
}

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
   EXPIRY
========================= */

function formatExpiry(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "VĨNH VIỄN";
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "KHÔNG XÁC ĐỊNH";
  }

  return d.toLocaleString(
    "vi-VN"
  );
}

/* =========================
   STATUS
========================= */

function setStatus(
  title,
  detail,
  type = ""
) {
  if (!result) return;

  result.classList.remove(
    "success",
    "error"
  );

  if (type) {
    result.classList.add(type);
  }

  if (statusTitle) {
    statusTitle.textContent =
      title;
  }

  if (statusDetail) {
    statusDetail.textContent =
      detail;
  }
}

function showDetails(
  data,
  stateText
) {
  if (keyDetails) {
    keyDetails.classList.remove(
      "hidden"
    );
  }

  if (keyState) {
    keyState.textContent =
      stateText;
  }

  if (expiry) {
    expiry.textContent =
      formatExpiry(
        data.expiresAt
      );
  }

  if (deviceState) {
    deviceState.textContent =
      data.deviceBound
        ? "ĐÃ GẮN 1 THIẾT BỊ"
        : "1 THIẾT BỊ";
  }
}

/* =========================
   ERROR TEXT
========================= */

function errorText(
  code,
  fallback
) {
  const map = {
    INVALID_KEY:
      "KEY KHÔNG TỒN TẠI",

    KEY_DISABLED:
      "KEY ĐÃ BỊ KHÓA",

    KEY_EXPIRED:
      "KEY ĐÃ HẾT HẠN",

    DEVICE_MISMATCH:
      "KEY ĐÃ GẮN THIẾT BỊ KHÁC",

    KEY_REQUIRED:
      "CHƯA NHẬP KEY",

    DEVICE_REQUIRED:
      "THIẾU MÃ THIẾT BỊ",

    SESSION_INVALID:
      "PHIÊN ĐĂNG NHẬP KHÔNG HỢP LỆ",

    SESSION_REQUIRED:
      "THIẾU PHIÊN ĐĂNG NHẬP"
  };

  return (
    map[code] ||
    fallback ||
    "KEY KHÔNG HỢP LỆ"
  );
}

/* =========================
   API REQUEST
========================= */

async function api(
  path,
  body
) {
  const response =
    await fetch(
      API + path,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            body || {}
          )
      }
    );

  let data = {};

  try {
    data =
      await response.json();
  } catch (_) {}

  return {
    response,
    data
  };
}

/* =========================
   VALIDATE INPUT
========================= */

function validateInput() {
  if (!keyInput) {
    return null;
  }

  const key =
    keyInput.value
      .trim()
      .toUpperCase();

  if (!key) {
    setStatus(
      "CHƯA NHẬP KEY",
      "Nhập mã HK-XXXX-XXXX-XXXX trước.",
      "error"
    );

    beep(180, 0.12);

    return null;
  }

  return key;
}

/* =========================
   KIỂM TRA KEY
   KHÔNG BIND DEVICE
========================= */

if (checkBtn) {
  checkBtn.addEventListener(
    "click",
    async () => {
      beep();

      const key =
        validateInput();

      if (!key) return;

      checkBtn.disabled = true;

      if (activateBtn) {
        activateBtn.disabled = true;
      }

      if (keyDetails) {
        keyDetails.classList.add(
          "hidden"
        );
      }

      setStatus(
        "ĐANG KIỂM TRA KEY",
        "Đang kiểm tra trạng thái và HSD..."
      );

      try {
        const {
          response,
          data
        } = await api(
          "/check",
          {
            key,
            deviceId:
              getDeviceId()
          }
        );

        if (
          !response.ok ||
          !data.valid
        ) {
          setStatus(
            errorText(
              data.code,
              data.message
            ),
            "Key không thể sử dụng.",
            "error"
          );

          beep(
            150,
            0.14
          );

          return;
        }

        if (
          data.deviceId &&
          data.deviceId !==
            getDeviceId()
        ) {
          setStatus(
            "KEY ĐÃ GẮN THIẾT BỊ KHÁC",
            "Không thể kích hoạt trên thiết bị này.",
            "error"
          );

          beep(
            150,
            0.14
          );

          return;
        }

        const state =
          data.deviceBound
            ? "ĐÃ KÍCH HOẠT"
            : "CÒN KHẢ DỤNG";

        showDetails(
          data,
          state
        );

        setStatus(
          "KEY HỢP LỆ",
          "Key còn sử dụng được. Hãy bấm Kích hoạt nếu đây là thiết bị của bạn.",
          "success"
        );

        hkSound("success");
      } catch (_) {
        setStatus(
          "LỖI KẾT NỐI",
          "Không thể kết nối máy chủ Render.",
          "error"
        );

        hkSound("error");
      } finally {
        checkBtn.disabled = false;

        if (activateBtn) {
          activateBtn.disabled = false;
        }
      }
    }
  );
}

/* =========================
   KÍCH HOẠT KEY
   BIND DEVICE + SESSION
========================= */

if (activateBtn) {
  activateBtn.addEventListener(
    "click",
    async () => {
      hkSound("activate");

      const key =
        validateInput();

      if (!key) return;

      checkBtn.disabled = true;
      activateBtn.disabled = true;

      setStatus(
        "ĐANG KÍCH HOẠT",
        "Đang gắn key với thiết bị này..."
      );

      try {
        const {
          response,
          data
        } = await api(
          "/activate",
          {
            key,
            deviceId:
              getDeviceId()
          }
        );

        if (
          !response.ok ||
          !data.valid
        ) {
          setStatus(
            errorText(
              data.code,
              data.message
            ),
            "Thiết bị này không được phép sử dụng key.",
            "error"
          );

          hkSound("error");

          return;
        }

        /* =========================
           NHẬN SESSION TOKEN
        ========================= */

        if (
          !data.sessionToken
        ) {
          setStatus(
            "THIẾU SESSION",
            "Máy chủ chưa cấp phiên đăng nhập.",
            "error"
          );

          hkSound("error");

          return;
        }

        /* =========================
           LƯU SESSION VĨNH VIỄN
        ========================= */

        const saved =
          saveSession(
            data.sessionToken
          );

        if (!saved) {
          setStatus(
            "KHÔNG LƯU ĐƯỢC SESSION",
            "Trình duyệt không cho phép lưu phiên đăng nhập.",
            "error"
          );

          hkSound("error");

          return;
        }

        /* =========================
           KIỂM TRA SESSION VỪA LƯU
        ========================= */

        const savedToken =
          getSession();

        if (
          !savedToken ||
          savedToken !==
            data.sessionToken
        ) {
          setStatus(
            "SESSION KHÔNG HỢP LỆ",
            "Không thể xác nhận phiên đăng nhập.",
            "error"
          );

          hkSound("error");

          return;
        }

        showDetails(
          data,
          "ĐÃ KÍCH HOẠT"
        );

        setStatus(
          "KÍCH HOẠT THÀNH CÔNG",
          "Đang mở app chính...",
          "success"
        );

        hkSound("success");

        /* =========================
           CHUYỂN APP CHÍNH
        ========================= */

        setTimeout(
          () => {
            window.location.href =
              "main.html";
          },
          700
        );
      } catch (_) {
        setStatus(
          "LỖI KẾT NỐI",
          "Không thể kết nối máy chủ Render.",
          "error"
        );

        hkSound("error");
      } finally {
        checkBtn.disabled = false;
        activateBtn.disabled = false;
      }
    }
  );
}

/* =========================
   PASTE
========================= */

if (pasteBtn) {
  pasteBtn.addEventListener(
    "click",
    async () => {
      hkSound("click");

      try {
        const text =
          await navigator
            .clipboard
            .readText();

        keyInput.value =
          String(text || "")
            .trim()
            .toUpperCase();

        setStatus(
          "ĐÃ DÁN KEY",
          "Bấm Kiểm tra key để xem HSD.",
          ""
        );
      } catch (_) {
        setStatus(
          "KHÔNG THỂ DÁN",
          "Trình duyệt không cho phép truy cập clipboard.",
          "error"
        );

        hkSound("error");
      }
    }
  );
}

/* =========================
   CLEAR
========================= */

if (clearBtn) {
  clearBtn.addEventListener(
    "click",
    () => {
      hkSound("click");

      if (keyInput) {
        keyInput.value = "";
      }

      if (keyDetails) {
        keyDetails.classList.add(
          "hidden"
        );
      }

      setStatus(
        "SẴN SÀNG",
        "Chưa Kích Hoạt"
      );

      if (keyInput) {
        keyInput.focus();
      }
    }
  );
}

/* =========================
   INPUT
========================= */

if (keyInput) {
  keyInput.addEventListener(
    "input",
    () => {
      keyInput.value =
        keyInput.value.toUpperCase();
    }
  );

  keyInput.addEventListener(
    "keydown",
    e => {
      if (e.key === "Enter") {
        if (checkBtn) {
          checkBtn.click();
        }
      }
    }
  );
}

/* =========================
   BUTTON SOUND FALLBACK
========================= */

document.addEventListener(
  "click",
  e => {
    const btn =
      e.target.closest(
        "button, a"
      );

    if (!btn) return;

    const label =
      (
        btn.textContent || ""
      )
        .trim()
        .toUpperCase();

    if (
      label.includes(
        "KIỂM TRA KEY"
      )
    ) {
      hkSound("click");
    }

    else if (
      label.includes(
        "KÍCH HOẠT"
      )
    ) {
      hkSound("activate");
    }

    else if (
      label.includes(
        "LIÊN HỆ LẤY KEY"
      )
    ) {
      hkSound("click");
    }
  }
);
