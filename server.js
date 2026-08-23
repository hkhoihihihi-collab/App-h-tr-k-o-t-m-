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
    if (!fs.existsSync(DB)) {
      return [];
    }

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
    Date.now() >=
      new Date(key.expiresAt).getTime()
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
   SESSION STORAGE
   Lưu trực tiếp trong keys.json
   Không timeout.
========================= */

function createSession(key, deviceId) {
  const keys = loadKeys();

  const currentKey = keys.find(
    x => x.id === key.id
  );

  if (!currentKey) {
    return null;
  }

  const token =
    crypto.randomBytes(48).toString("hex");

  currentKey.sessionToken = token;
  currentKey.sessionDeviceId = deviceId;
  currentKey.sessionCreatedAt =
    new Date().toISOString();

  saveKeys(keys);

  return token;
}

function findSession(token) {
  if (!token) {
    return null;
  }

  const keys = loadKeys();

  const key = keys.find(
    x => x.sessionToken === token
  );

  if (!key) {
    return null;
  }

  return {
    key,
    deviceId: key.sessionDeviceId || null,
    createdAt:
      key.sessionCreatedAt || null
  };
}

function deleteSessionForKey(keyId) {
  const keys = loadKeys();

  const key = keys.find(
    x => x.id === keyId
  );

  if (!key) {
    return;
  }

  delete key.sessionToken;
  delete key.sessionDeviceId;
  delete key.sessionCreatedAt;

  saveKeys(keys);
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
   ADMIN
========================= */

app.get(
  "/api/keys",
  adminAuth,
  (req, res) => {
    res.json(loadKeys());
  }
);

app.post(
  "/api/keys",
  adminAuth,
  (req, res) => {
    const keys = loadKeys();

    const type = String(
      req.body.duration || "30d"
    );

    const key = {
      id: crypto.randomUUID(),
      key: makeKey(),
      createdAt:
        new Date().toISOString(),
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
  }
);

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
      key.disabled =
        Boolean(req.body.disabled);

      if (key.disabled) {
        delete key.sessionToken;
        delete key.sessionDeviceId;
        delete key.sessionCreatedAt;
      }
    }

    if (
      req.body.resetDevice === true
    ) {
      key.deviceId = null;
      key.boundAt = null;

      delete key.sessionToken;
      delete key.sessionDeviceId;
      delete key.sessionCreatedAt;
    }

    saveKeys(keys);

    res.json(key);
  }
);

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
   Không bind device
========================= */

app.post(
  "/api/check",
  (req, res) => {
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
        validation.code ===
          "INVALID_KEY"
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
  }
);

/* =========================
   ACTIVATE KEY
   Bind device + session
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
        validation.code ===
          "INVALID_KEY"
          ? 404
          : 403
      ).json(validation);
    }

    const key = found.key;

    const firstActivation =
      !key.deviceId;

    if (firstActivation) {
      key.deviceId = deviceId;
      key.boundAt =
        new Date().toISOString();

      saveKeys(found.keys);
    }

    if (
      key.deviceId !== deviceId
    ) {
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

    if (!sessionToken) {
      return res.status(500).json({
        valid: false,
        code: "SESSION_CREATE_FAILED",
        message:
          "Could not create session"
      });
    }

    return res.json({
      valid: true,
      firstActivation,
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
========================= */

app.post(
  "/api/session",
  (req, res) => {
    const authorization =
      req.headers.authorization || "";

    const token =
      authorization.startsWith(
        "Bearer "
      )
        ? authorization
            .slice(7)
            .trim()
        : "";

    if (!token) {
      return res.status(401).json({
        valid: false,
        code: "SESSION_REQUIRED",
        message:
          "Session token is required"
      });
    }

    const session =
      findSession(token);

    if (!session) {
      return res.status(401).json({
        valid: false,
        code: "SESSION_INVALID",
        message:
          "Invalid session"
      });
    }

    const key = session.key;

    const validation =
      validateKey(key);

    if (!validation.valid) {
      deleteSessionForKey(key.id);

      return res.status(403).json({
        valid: false,
        code: validation.code,
        message: validation.message
      });
    }

    if (
      !key.deviceId ||
      !session.deviceId ||
      key.deviceId !==
        session.deviceId
    ) {
      deleteSessionForKey(key.id);

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
    const authorization =
      req.headers.authorization || "";

    const token =
      authorization.startsWith(
        "Bearer "
      )
        ? authorization
            .slice(7)
            .trim()
        : "";

    const session =
      findSession(token);

    if (session) {
      deleteSessionForKey(
        session.key.id
      );
    }

    res.json({
      ok: true
    });
  }
);

/* =========================
   OLD VERIFY API
   Giữ tương thích app cũ
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
        message:
          "Device ID is required"
      });
    }

    const found = findKey(input);

    const validation =
      validateKey(found.key);

    if (!validation.valid) {
      return res.status(
        validation.code ===
          "INVALID_KEY"
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

    if (
      key.deviceId === deviceId
    ) {
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
      service:
        "hk-key-manager",
      system:
        "1-key-1-device",
      session:
        "persistent-until-key-invalid"
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
