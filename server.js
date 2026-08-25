const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ROOT = __dirname;
const DB = path.join(ROOT, "keys.json");

if (!ADMIN_PASSWORD) {
  console.error("ERROR: ADMIN_PASSWORD is not configured.");
  process.exit(1);
}

/*
  SESSION FIX
  Session token is stored with the key record instead of only in RAM.
  Render restart/redeploy will therefore not invalidate a valid session.
*/

function createSession(key, deviceId) {
  const token = crypto.randomBytes(32).toString("hex");

  key.sessionToken = token;
  key.sessionDeviceId = deviceId;
  key.sessionCreatedAt = new Date().toISOString();

  return token;
}

function clearKeySession(key) {
  if (!key) return;
  delete key.sessionToken;
  delete key.sessionDeviceId;
  delete key.sessionCreatedAt;
}

function verifySessionToken(keys, token) {
  if (!token) return null;

  return keys.find(
    key =>
      key.sessionToken &&
      key.sessionToken === token
  ) || null;
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

  if (type === "forever") return null;

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
        String(x.key || "")
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

  return { valid: true };
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
   ADMIN: LIST
========================= */

app.get("/api/keys", adminAuth, (req, res) => {
  res.json(loadKeys());
});

/* =========================
   ADMIN: CREATE
========================= */

app.post("/api/keys", adminAuth, (req, res) => {
  const keys = loadKeys();

  const type = String(
    req.body.duration || "30d"
  );

  const key = {
    id: crypto.randomUUID(),
    key: makeKey(),
    appId: String(req.body.appId || "all"),
    createdAt: new Date().toISOString(),
    expiresAt: expiration(
      type,
      req.body.custom
    ),
    disabled: false,
    deviceId: null,
    boundAt: null,
    sessionToken: null,
    sessionDeviceId: null,
    sessionCreatedAt: null
  };

  keys.push(key);
  saveKeys(keys);

  res.json(key);
});

/* =========================
   ADMIN: UPDATE
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
        clearKeySession(key);
      }
    }

    if (req.body.resetDevice === true) {
      key.deviceId = null;
      key.boundAt = null;
      clearKeySession(key);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "appId"
      )
    ) {
      key.appId = String(
        req.body.appId || "all"
      );
    }

    saveKeys(keys);

    res.json(key);
  }
);

/* =========================
   ADMIN: DELETE
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

    saveKeys(
      keys.filter(
        x => x.id !== req.params.id
      )
    );

    res.json({ ok: true });
  }
);

/* =========================
   CHECK KEY
========================= */

app.post("/api/check", (req, res) => {
  const keyInput = req.body.key;
  const deviceId = String(
    req.body.deviceId || ""
  ).trim();

  if (!keyInput) {
    return res.status(400).json({
      valid: false,
      code: "KEY_REQUIRED",
      message: "Key is required"
    });
  }

  const found = findKey(keyInput);
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

  res.json({
    valid: true,
    deviceBound: Boolean(key.deviceId),
    deviceId: key.deviceId || null,
    sameDevice:
      Boolean(deviceId) &&
      Boolean(key.deviceId) &&
      key.deviceId === deviceId,
    expiresAt: key.expiresAt
  });
});

/* =========================
   ACTIVATE
========================= */

app.post("/api/activate", (req, res) => {
  const input = String(
    req.body.key || ""
  ).trim().toUpperCase();

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
    key.boundAt = new Date().toISOString();
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

  saveKeys(found.keys);

  return res.json({
    valid: true,
    firstActivation:
      Boolean(
        key.boundAt &&
        key.sessionCreatedAt === key.boundAt
      ),
    deviceBound: true,
    expiresAt: key.expiresAt,
    sessionToken
  });
});

/* =========================
   SESSION
   Persistent across Render restart.
   Still invalidates on:
   - expired key
   - disabled key
   - deleted key
   - device mismatch
========================= */

app.post("/api/session", (req, res) => {
  const auth =
    req.headers.authorization || "";

  const token =
    auth.startsWith("Bearer ")
      ? auth.slice(7).trim()
      : "";

  if (!token) {
    return res.status(401).json({
      valid: false,
      code: "SESSION_REQUIRED",
      message: "Session required"
    });
  }

  const keys = loadKeys();
  const key =
    verifySessionToken(keys, token);

  if (!key) {
    return res.status(401).json({
      valid: false,
      code: "SESSION_INVALID",
      message: "Invalid session"
    });
  }

  const validation =
    validateKey(key);

  if (!validation.valid) {
    clearKeySession(key);
    saveKeys(keys);

    return res.status(403).json({
      valid: false,
      code: validation.code,
      message: validation.message
    });
  }

  if (
    !key.deviceId ||
    !key.sessionDeviceId ||
    key.deviceId !== key.sessionDeviceId
  ) {
    clearKeySession(key);
    saveKeys(keys);

    return res.status(403).json({
      valid: false,
      code: "DEVICE_MISMATCH",
      message: "Session device mismatch"
    });
  }

  return res.json({
    valid: true,
    expiresAt: key.expiresAt
  });
});

/* =========================
   LOGOUT
========================= */

app.post("/api/logout", (req, res) => {
  const auth =
    req.headers.authorization || "";

  const token =
    auth.startsWith("Bearer ")
      ? auth.slice(7).trim()
      : "";

  const keys = loadKeys();
  const key =
    verifySessionToken(keys, token);

  if (key) {
    clearKeySession(key);
    saveKeys(keys);
  }

  res.json({ ok: true });
});

/* =========================
   OLD VERIFY API
========================= */

app.post("/api/verify", (req, res) => {
  const input = String(
    req.body.key || ""
  ).trim().toUpperCase();

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
    key.boundAt = new Date().toISOString();
    saveKeys(found.keys);

    return res.json({
      valid: true,
      firstActivation: true,
      deviceBound: true,
      expiresAt: key.expiresAt
    });
  }

  if (key.deviceId === deviceId) {
    return res.json({
      valid: true,
      firstActivation: false,
      deviceBound: true,
      expiresAt: key.expiresAt
    });
  }

  return res.status(403).json({
    valid: false,
    code: "DEVICE_MISMATCH",
    message:
      "Key is already activated on another device"
  });
});

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "hk-key-manager",
    system: "1-key-1-device",
    session:
      "persistent-in-keys.json-until-key-invalid",
    version: "4"
  });
});

/* =========================
   START
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `HK Key Manager running on ${PORT}`
  );
});
