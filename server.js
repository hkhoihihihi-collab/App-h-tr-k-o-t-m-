const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ROOT = __dirname;
const DB = path.join(ROOT, "keys.json");

/* =========================
   STARTUP
========================= */

if (!ADMIN_PASSWORD) {
  console.error("ERROR: ADMIN_PASSWORD is not configured.");
  process.exit(1);
}

/* =========================
   SESSIONS
   Không có thời gian hết hạn.
   Session chỉ mất hiệu lực khi
   key không còn hợp lệ hoặc
   bị xóa khỏi bộ nhớ server.
========================= */

const APP_SESSIONS = new Map();

function createSession(key, deviceId) {
  const token = crypto.randomBytes(32).toString("hex");

  APP_SESSIONS.set(token, {
    keyId: key.id,
    deviceId: deviceId,
    createdAt: new Date().toISOString()
  });

  return token;
}

function verifySession(token) {
  if (!token) return null;

  return APP_SESSIONS.get(token) || null;
}

function deleteSession(token) {
  if (token) {
    APP_SESSIONS.delete(token);
  }
}

function deleteKeySessions(keyId) {
  for (const [token, session] of APP_SESSIONS.entries()) {
    if (session.keyId === keyId) {
      APP_SESSIONS.delete(token);
    }
  }
}

/* =========================
   CORS
========================= */

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, x-admin-password, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(ROOT));

/* =========================
   DATABASE
========================= */

function loadKeys() {
  try {
    if (!fs.existsSync(DB)) return [];

    const data = JSON.parse(
      fs.readFileSync(DB, "utf8")
    );

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Database error:", error);
    return [];
  }
}

function saveKeys(keys) {
  fs.writeFileSync(
    DB,
    JSON.stringify(keys, null, 2),
    "utf8"
  );
}

/* =========================
   KEY GENERATOR
========================= */

function makeKey() {
  const part = () =>
    crypto
      .randomBytes(2)
      .toString("hex")
      .toUpperCase();

  return `HK-${part()}-${part()}-${part()}`;
}

/* =========================
   EXPIRATION
========================= */

function expiration(type, custom) {
  const now = Date.now();

  const map = {
    "1h": 3600000,
    "6h": 21600000,
    "12h": 43200000,
    "1d": 86400000,
    "3d": 259200000,
    "7d": 604800000,
    "14d": 1209600000,
    "30d": 2592000000,
    "3m": 7776000000,
    "6m": 15552000000,
    "1y": 31536000000
  };

  if (type === "forever") {
    return null;
  }

  if (type === "custom") {
    const timestamp = new Date(custom).getTime();

    if (!Number.isFinite(timestamp)) {
      return null;
    }

    return new Date(timestamp).toISOString();
  }

  return new Date(
    now + (map[type] || map["30d"])
  ).toISOString();
}

/* =========================
   FIND KEY
========================= */

function findKey(input) {
  const keys = loadKeys();

  const normalized = String(input || "")
    .trim()
    .toUpperCase();

  return {
    keys,
    key: keys.find(
      x =>
        String(x.key)
          .trim()
          .toUpperCase() === normalized
    )
  };
}

/* =========================
   VALIDATE KEY
========================= */

function validateKey(key) {
  if (!key) {
    return {
      valid: false,
      code: "INVALID_KEY",
      message: "Invalid key"
    };
  }

  if (key.disabled) {
    return {
      valid: false,
      code: "KEY_DISABLED",
      message: "Key disabled"
    };
  }

  if (
    key.expiresAt !== null &&
    key.expiresAt &&
    Date.now() >= new Date(key.expiresAt).getTime()
  ) {
    return {
      valid: false,
      code: "KEY_EXPIRED",
      message: "Key expired"
    };
  }

  return {
    valid: true
  };
}

/* =========================
   ADMIN AUTH
========================= */

function adminAuth(req, res, next) {
  const supplied =
    req.headers["x-admin-password"];

  if (
    !supplied ||
    supplied !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

/* =========================
   ADMIN: LIST KEYS
========================= */

app.get("/api/keys", adminAuth, (req, res) => {
  res.json(loadKeys());
});

/* =========================
   ADMIN: CREATE KEY
========================= */

app.post("/api/keys", adminAuth, (req, res) => {
  const keys = loadKeys();

  const type = String(
    req.body.duration || "30d"
  );

  const key = {
    id: crypto.randomUUID(),
    key: makeKey(),
    createdAt: new Date().toISOString(),
    expiresAt: expiration(
      type,
      req.body.custom
    ),
    disabled: false,
    deviceId: null,
    boundAt: null
  };

  keys.push(key);
  saveKeys(keys);

  res.json(key);
});

/* =========================
   ADMIN: UPDATE KEY
========================= */

app.patch(
  "/api/keys/:id",
  adminAuth,
  (req, res) => {
    const keys = loadKeys();

    const key = keys.find(
      x => x.id === req.params.id
    );

    if (!key) {
      return res.status(404).json({
        error: "Key not found"
      });
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "disabled"
      )
    ) {
      key.disabled = Boolean(
        req.body.disabled
      );

      if (key.disabled) {
        deleteKeySessions(key.id);
      }
    }

    if (req.body.resetDevice === true) {
      key.deviceId = null;
      key.boundAt = null;

      deleteKeySessions(key.id);
    }

    saveKeys(keys);

    res.json(key);
  }
);

/* =========================
   ADMIN: DELETE KEY
========================= */

app.delete(
  "/api/keys/:id",
  adminAuth,
  (req, res) => {
    const keys = loadKeys();

    const key = keys.find(
      x => x.id === req.params.id
    );

    if (!key) {
      return res.status(404).json({
        error: "Key not found"
      });
    }

    deleteKeySessions(key.id);

    const filtered = keys.filter(
      x => x.id !== req.params.id
    );

    saveKeys(filtered);

    res.json({
      ok: true
    });
  }
);

/* =========================
   CHECK KEY
   Không bind thiết bị
========================= */

app.post("/api/check", (req, res) => {
  const {
    key,
    deviceId
  } = req.body;

  if (!key) {
    return res.status(400).json({
      valid: false,
      code: "KEY_REQUIRED",
      message: "Key is required"
    });
  }

  const found = findKey(key);
  const validation =
    validateKey(found.key);

  if (!validation.valid) {
    return res.status(
      validation.code === "INVALID_KEY"
        ? 404
        : 403
    ).json(validation);
  }

  const deviceBound =
    Boolean(found.key.deviceId);

  return res.json({
    valid: true,
    deviceBound,
    deviceId:
      found.key.deviceId || null,
    sameDevice:
      Boolean(deviceId) &&
      Boolean(found.key.deviceId) &&
      found.key.deviceId ===
        String(deviceId).trim(),
    expiresAt:
      found.key.expiresAt
  });
});

/* =========================
   ACTIVATE KEY
   Bind device + create session
========================= */

app.post(
  "/api/activate",
  (req, res) => {
    const input = String(
      req.body.key || ""
    )
      .trim()
      .toUpperCase();

    const deviceId = String(
      req.body.deviceId || ""
    ).trim();

    if (!input) {
      return res.status(400).json({
        valid: false,
        code: "KEY_REQUIRED",
        message: "Key is required"
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        valid: false,
        code: "DEVICE_REQUIRED",
        message: "Device ID is required"
      });
    }

    const found = findKey(input);
    const validation =
      validateKey(found.key);

    if (!validation.valid) {
      return res.status(
        validation.code === "INVALID_KEY"
          ? 404
          : 403
      ).json(validation);
    }

    const key = found.key;

    if (!key.deviceId) {
      key.deviceId = deviceId;
      key.boundAt =
        new Date().toISOString();

      saveKeys(found.keys);
    }

    if (key.deviceId !== deviceId) {
      return res.status(403).json({
        valid: false,
        code: "DEVICE_MISMATCH",
        message:
          "Key is already activated on another device"
      });
    }

    const sessionToken =
      createSession(
        key,
        deviceId
      );

    return res.json({
      valid: true,
      firstActivation:
        Boolean(key.boundAt),
      deviceBound: true,
      expiresAt:
        key.expiresAt,
      sessionToken
    });
  }
);

/* =========================
   VERIFY SESSION
   Không timeout.
   Nhưng vẫn kiểm tra key thật.
========================= */

app.post(
  "/api/session",
  (req, res) => {
    const auth =
      req.headers.authorization || "";

    const token =
      auth.startsWith("Bearer ")
        ? auth.slice(7).trim()
        : "";

    const session =
      verifySession(token);

    if (!session) {
      return res.status(401).json({
        valid: false,
        code: "SESSION_INVALID",
        message: "Invalid session"
      });
    }

    const keys = loadKeys();

    const key = keys.find(
      x => x.id === session.keyId
    );

    const validation =
      validateKey(key);

    if (!validation.valid) {
      deleteSession(token);

      return res.status(403).json({
        valid: false,
        code: validation.code,
        message: validation.message
      });
    }

    if (
      !key.deviceId ||
      key.deviceId !== session.deviceId
    ) {
      deleteSession(token);

      return res.status(403).json({
        valid: false,
        code: "DEVICE_MISMATCH",
        message:
          "Session device mismatch"
      });
    }

    return res.json({
      valid: true,
      expiresAt:
        key.expiresAt
    });
  }
);

/* =========================
   LOGOUT
========================= */

app.post(
  "/api/logout",
  (req, res) => {
    const auth =
      req.headers.authorization || "";

    const token =
      auth.startsWith("Bearer ")
        ? auth.slice(7).trim()
        : "";

    deleteSession(token);

    res.json({
      ok: true
    });
  }
);

/* =========================
   OLD VERIFY API
========================= */

app.post(
  "/api/verify",
  (req, res) => {
    const input = String(
      req.body.key || ""
    )
      .trim()
      .toUpperCase();

    const deviceId = String(
      req.body.deviceId || ""
    ).trim();

    if (!input) {
      return res.status(400).json({
        valid: false,
        code: "KEY_REQUIRED",
        message: "Key is required"
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        valid: false,
        code: "DEVICE_REQUIRED",
        message: "Device ID is required"
      });
    }

    const found = findKey(input);

    const validation =
      validateKey(found.key);

    if (!validation.valid) {
      return res.status(
        validation.code === "INVALID_KEY"
          ? 404
          : 403
      ).json(validation);
    }

    const key = found.key;

    if (!key.deviceId) {
      key.deviceId = deviceId;
      key.boundAt =
        new Date().toISOString();

      saveKeys(found.keys);

      return res.json({
        valid: true,
        firstActivation: true,
        deviceBound: true,
        expiresAt:
          key.expiresAt
      });
    }

    if (key.deviceId === deviceId) {
      return res.json({
        valid: true,
        firstActivation: false,
        deviceBound: true,
        expiresAt:
          key.expiresAt
      });
    }

    return res.status(403).json({
      valid: false,
      code: "DEVICE_MISMATCH",
      message:
        "Key is already activated on another device"
    });
  }
);

/* =========================
   HEALTH
========================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "hk-key-manager",
      system: "1-key-1-device",
      session: "persistent-until-key-invalid"
    });
  }
);

/* =========================
   START
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `HK Key Manager running on ${PORT}`
    );
  }
);
