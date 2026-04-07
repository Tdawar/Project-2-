const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { kmeans } = require("ml-kmeans");
const app = express();

console.log("LATEST AZURE BACKEND VERSION LOADED");

// CORS origins are controlled by environment to keep local values out of commits.
function normalizeOrigin(origin) {
  return String(origin || "")
    .trim()
    .replace(/\/+$/, "");
}

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "https://red-meadow-0888e270f.2.azurestaticapps.net",
].map(normalizeOrigin);

const configuredOrigins = (
  process.env.FRONTEND_ORIGINS ||
  process.env.FRONTEND_ORIGIN ||
  ""
)
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([...defaultAllowedOrigins, ...configuredOrigins]),
);

const isProduction = process.env.NODE_ENV === "production";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "development-only-change-me";

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required in production.");
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = parseIntInRange(
  process.env.RATE_LIMIT_MAX,
  120,
  10,
  10000,
);

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

app.set("trust proxy", 1);
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server calls and local tools without Origin header.
      if (!origin) return callback(null, true);
      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin))
        return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(
  session({
    name: "ni.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
    },
  }),
);

app.use("/api", apiLimiter);
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CSV_PATH = path.join(__dirname, "All_Diets.csv");
const LOGIN_PROVIDERS = new Set(["google", "github"]);
const AUTH_TTL_MS = 5 * 60 * 1000;
/** Periodic sweep for expired OTP challenges (does not clear CSV cache). */
const AUTO_CLEANUP_INTERVAL_MS = 2 * 60 * 1000;
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://red-meadow-0888e270f.2.azurestaticapps.net";

let cachedRows = null;
const authChallenges = new Map();

let lastCleanupAt = null;
let lastCleanupStats = null;

const smtpConfigured =
  Boolean(process.env.SMTP_HOST) &&
  Boolean(process.env.SMTP_PORT) &&
  Boolean(process.env.SMTP_USER) &&
  Boolean(process.env.SMTP_PASS) &&
  Boolean(process.env.OTP_FROM_EMAIL);

const mailer = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      (accessToken, refreshToken, profile, done) => {
        done(null, {
          provider: "google",
          id: profile.id,
          displayName: profile.displayName,
          email: profile.emails?.[0]?.value || "",
        });
      }
    )
  );
}

if (
  process.env.GITHUB_CLIENT_ID &&
  process.env.GITHUB_CLIENT_SECRET &&
  process.env.GITHUB_CALLBACK_URL
) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL,
        scope: ["user:email"],
      },
      (accessToken, refreshToken, profile, done) => {
        const email =
          profile.emails?.find((e) => e.verified)?.value ||
          profile.emails?.[0]?.value ||
          "";

        done(null, {
          provider: "github",
          id: profile.id,
          displayName: profile.displayName || profile.username,
          email,
        });
      }
    )
  );
}

function toLower(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const cleaned = String(v)
    .replace(",", ".")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function avg(nums) {
  if (!nums.length) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 100) / 100;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function corr(a, b) {
  if (!a.length || !b.length || a.length !== b.length) return 0;

  const ma = mean(a);
  const mb = mean(b);

  let num = 0;
  let da = 0;
  let db = 0;

  for (let i = 0; i < a.length; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }

  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

function detectDelimiter(filePath) {
  const head = fs.readFileSync(filePath, "utf8").slice(0, 5000);
  const firstLine = head.split(/\r?\n/)[0] || "";

  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  return ",";
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return String(row[key]).trim();
    }
  }
  return "";
}

function generateSixDigitCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function cleanupAuthChallenges() {
  const now = Date.now();
  let removed = 0;
  for (const [challengeId, challenge] of authChallenges.entries()) {
    if (challenge.expiresAt <= now) {
      authChallenges.delete(challengeId);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Removes expired OTP challenges and clears the in-memory CSV row cache.
 * Next request to insights/recipes/clusters will reload from disk.
 */
function runFullResourceCleanup() {
  const removedExpiredChallenges = cleanupAuthChallenges();
  const csvCacheCleared = cachedRows !== null;
  cachedRows = null;
  lastCleanupAt = Date.now();
  lastCleanupStats = {
    removedExpiredChallenges,
    csvCacheCleared,
  };
  return { ...lastCleanupStats, at: lastCleanupAt };
}

function getCleanupStatus() {
  let nextExpiryAt = null;
  const now = Date.now();
  for (const challenge of authChallenges.values()) {
    const exp = challenge.expiresAt;
    if (nextExpiryAt === null || exp < nextExpiryAt) {
      nextExpiryAt = exp;
    }
  }
  return {
    activeChallenges: authChallenges.size,
    csvCacheLoaded: cachedRows !== null,
    csvCacheRowCount: cachedRows ? cachedRows.length : 0,
    lastCleanupAt,
    lastCleanupStats,
    nextExpiryAt,
    nextExpiryInMs:
      nextExpiryAt != null ? Math.max(0, nextExpiryAt - now) : null,
  };
}

function maskEmail(email) {
  const [local, domain] = String(email || "").split("@");
  if (!local || !domain) return "not-available";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

async function sendOtpEmail(toEmail, code, provider) {
  if (!mailer) {
    throw new Error("OTP email delivery is not configured on the server");
  }

  await mailer.sendMail({
    from: process.env.OTP_FROM_EMAIL,
    to: toEmail,
    subject: "Your Nutritional Insights 2FA Code",
    text: `Your ${provider} login OTP is ${code}. It expires in 5 minutes.`,
  });
}

function resolveAuthOptions(provider) {
  if (provider === "google") {
    return {
      strategy: "google",
      options: { scope: ["profile", "email"] },
    };
  }

  if (provider === "github") {
    return {
      strategy: "github",
      options: { scope: ["read:user", "user:email"] },
    };
  }

  return null;
}

function providerConfigured(provider) {
  if (provider === "google") {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CALLBACK_URL
    );
  }

  if (provider === "github") {
    return Boolean(
      process.env.GITHUB_CLIENT_ID &&
        process.env.GITHUB_CLIENT_SECRET &&
        process.env.GITHUB_CALLBACK_URL
    );
  }

  return false;
}

async function loadCSV() {
  if (cachedRows) return cachedRows;

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at: ${CSV_PATH}`);
  }

  const delimiter = detectDelimiter(CSV_PATH);
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH, { encoding: "utf8" })
      .pipe(
        csv({
          separator: delimiter,
          mapHeaders: ({ header }) =>
            String(header || "")
              .replace(/^\uFEFF/, "")
              .trim(),
          mapValues: ({ value }) =>
            typeof value === "string" ? value.trim() : value,
        }),
      )
      .on("data", (row) => {
        const diet = pickValue(row, [
          "Diet_type",
          "Diet Type",
          "diet_type",
          "diet",
          "Diet",
          "DietType",
          "dietType",
        ]);

        const recipe = pickValue(row, [
          "Recipe_name",
          "Recipe Name",
          "recipe_name",
          "Recipe",
          "RecipeName",
          "name",
        ]);

        const cuisine =
          pickValue(row, [
            "Cuisine_type",
            "Cuisine Type",
            "cuisine_type",
            "Cuisine",
            "CuisineType",
            "cuisine",
          ]) || "Unknown";

        const protein = toNumber(
          row["Protein(g)"] ??
            row["Protein (g)"] ??
            row["Protein"] ??
            row["protein"] ??
            row["protein(g)"],
        );

        const carbs = toNumber(
          row["Carbs(g)"] ??
            row["Carbs (g)"] ??
            row["Carbohydrates (g)"] ??
            row["Carbohydrates"] ??
            row["Carbs"] ??
            row["carbs"],
        );

        const fat = toNumber(
          row["Fat(g)"] ??
            row["Fat (g)"] ??
            row["Fat"] ??
            row["fat"] ??
            row["Fats (g)"],
        );

        if (!diet || !recipe) return;

        rows.push({
          dietType: diet,
          diet,
          name: recipe,
          recipe_name: recipe,
          cuisine_type: cuisine,
          protein,
          carbs,
          fat,
          calories: Math.round(protein * 4 + carbs * 4 + fat * 9),
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  cachedRows = rows;

  console.log("CSV loaded");
  console.log("Delimiter detected:", JSON.stringify(delimiter));
  console.log("Rows loaded:", rows.length);
  console.log("Sample row:", rows[0]);

  return rows;
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Nutritional Insights Backend Running",
    csvFound: fs.existsSync(CSV_PATH),
  });
});

app.get("/api/security/status", (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    security: {
      helmetEnabled: true,
      rateLimitEnabled: true,
      rateLimit: {
        windowMs: RATE_LIMIT_WINDOW_MS,
        max: RATE_LIMIT_MAX,
      },
      session: {
        enabled: true,
        cookieName: "ni.sid",
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
      },
      cors: {
        restricted: true,
        allowedOrigins,
        credentials: true,
      },
    },
  });
});

app.get("/api/insights", async (req, res) => {
  try {
    const dietType = toLower(req.query.dietType || "all");
    const q = toLower(req.query.q || "");

    const rows = await loadCSV();

    let filtered = rows;

    if (dietType !== "all") {
      filtered = filtered.filter((r) => toLower(r.diet) === dietType);
    }

    if (q) {
      filtered = filtered.filter(
        (r) =>
          toLower(r.diet).includes(q) ||
          toLower(r.name).includes(q) ||
          toLower(r.cuisine_type).includes(q),
      );
    }

    const grouped = new Map();

    for (const r of filtered) {
      if (!grouped.has(r.diet)) {
        grouped.set(r.diet, {
          count: 0,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        });
      }

      const g = grouped.get(r.diet);
      g.count += 1;
      g.calories += r.calories;
      g.protein += r.protein;
      g.carbs += r.carbs;
      g.fat += r.fat;
    }

    const docs = Array.from(grouped.entries())
      .map(([diet, g]) => ({
        diet,
        count: g.count,
        calories: avg([g.calories / g.count]),
        protein: avg([g.protein / g.count]),
        carbs: avg([g.carbs / g.count]),
        fat: avg([g.fat / g.count]),
      }))
      .sort((a, b) => a.diet.localeCompare(b.diet));

    const p = filtered.map((r) => r.protein);
    const c = filtered.map((r) => r.carbs);
    const f = filtered.map((r) => r.fat);

    res.json({
      barData: {
        labels: docs.map((d) => d.diet),
        datasets: [
          { label: "Protein", data: docs.map((d) => d.protein) },
          { label: "Carbs", data: docs.map((d) => d.carbs) },
          { label: "Fat", data: docs.map((d) => d.fat) },
        ],
      },
      scatterData: {
        datasets: [
          {
            label: "Protein vs Carbs",
            data: docs.map((d) => ({ x: d.carbs, y: d.protein })),
          },
        ],
      },
      pieData: {
        labels: docs.map((d) => d.diet),
        datasets: [{ data: docs.map((d) => d.count) }],
      },
      heatmap: {
        labels: ["Protein", "Carbs", "Fat"],
        values: [
          [1, Number(corr(p, c).toFixed(3)), Number(corr(p, f).toFixed(3))],
          [Number(corr(c, p).toFixed(3)), 1, Number(corr(c, f).toFixed(3))],
          [Number(corr(f, p).toFixed(3)), Number(corr(f, c).toFixed(3)), 1],
        ],
      },
      summary: {
        totalDietTypes: docs.length,
        avgCalories: avg(docs.map((d) => d.calories)),
        avgProtein: avg(docs.map((d) => d.protein)),
        avgCarbs: avg(docs.map((d) => d.carbs)),
        avgFat: avg(docs.map((d) => d.fat)),
        bestHighProtein:
          docs.slice().sort((a, b) => b.protein - a.protein)[0]?.diet || null,
        bestLowCarb:
          docs.slice().sort((a, b) => a.carbs - b.carbs)[0]?.diet || null,
      },
      meta: {
        total: docs.length,
        rows: filtered.length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/recipes", async (req, res) => {
  try {
    const dietType = toLower(req.query.dietType || "all");
    const q = toLower(req.query.q || "");
    const page = parseIntInRange(req.query.page, 1, 1, 100000);
    const pageSize = parseIntInRange(req.query.pageSize, 10, 1, 100);

    const rows = await loadCSV();

    let filtered = rows;

    if (dietType !== "all") {
      filtered = filtered.filter((r) => toLower(r.dietType) === dietType);
    }

    if (q) {
      filtered = filtered.filter(
        (r) =>
          toLower(r.name).includes(q) || toLower(r.cuisine_type).includes(q),
      );
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;

    const items = filtered
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(start, start + pageSize);

    res.json({
      recipes: items.map((r) => ({
        // Deterministic id supports stable React keys in the frontend.
        id: `${r.name}::${r.dietType}::${r.cuisine_type}::${r.calories}`,
        name: r.name,
        dietType: r.dietType,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        cuisine: r.cuisine_type,
      })),
      meta: { page, pageSize, total, dietType, q },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/clusters", async (req, res) => {
  try {
    const dietType = toLower(req.query.dietType || "all");
    const q = toLower(req.query.q || "");
    const k = parseIntInRange(req.query.k, 3, 2, 10);

    const rows = await loadCSV();
    let filtered = rows;

    if (dietType !== "all") {
      filtered = filtered.filter((r) => toLower(r.dietType) === dietType);
    }

    if (q) {
      filtered = filtered.filter(
        (r) =>
          toLower(r.name).includes(q) || toLower(r.cuisine_type).includes(q),
      );
    }

    if (!filtered.length) {
      return res.json({ k, clusterCenters: [], sample: [] });
    }

    const X = filtered.map((r) => [r.protein, r.carbs, r.fat]);
    const result = kmeans(X, k);

    const centers = result.centroids.map((c) =>
      c.map((v) => Number(v.toFixed(2))),
    );

    const sample = [];
    const limit = Math.min(50, filtered.length);

    for (let i = 0; i < limit; i++) {
      sample.push({
        name: filtered[i].name,
        dietType: filtered[i].dietType,
        protein: filtered[i].protein,
        carbs: filtered[i].carbs,
        fat: filtered[i].fat,
        cluster: result.clusters[i],
      });
    }

    res.json({
      k,
      clusterCenters: centers,
      sample,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/cleanup", (req, res) => {
  try {
    const result = runFullResourceCleanup();
    res.json({
      ok: true,
      removedExpiredChallenges: result.removedExpiredChallenges,
      csvCacheCleared: result.csvCacheCleared,
      at: new Date(result.at).toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/cleanup/status", (req, res) => {
  try {
    const s = getCleanupStatus();
    res.json({
      ok: true,
      activeChallenges: s.activeChallenges,
      csvCacheLoaded: s.csvCacheLoaded,
      csvCacheRowCount: s.csvCacheRowCount,
      lastCleanupAt:
        s.lastCleanupAt != null
          ? new Date(s.lastCleanupAt).toISOString()
          : null,
      lastCleanupStats: s.lastCleanupStats,
      nextChallengeExpiryAt:
        s.nextExpiryAt != null ? new Date(s.nextExpiryAt).toISOString() : null,
      nextChallengeExpiresInMs: s.nextExpiryInMs,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const cleanupTimer = setInterval(() => {
  const removed = cleanupAuthChallenges();
  if (removed > 0) {
    console.log(
      `[cleanup] removed ${removed} expired OTP challenge(s) (auto)`
    );
  }
}, AUTO_CLEANUP_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CSV path: ${CSV_PATH}`);
  console.log(
    `Auto OTP cleanup every ${AUTO_CLEANUP_INTERVAL_MS / 1000}s (timer ${cleanupTimer})`
  );
});
