const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const { Strategy: GitHubStrategy } = require("passport-github2");
const nodemailer = require("nodemailer");
const csv = require("csv-parser");
const { kmeans } = require("ml-kmeans");

require("dotenv").config();

const app = express();

console.log("LATEST AZURE BACKEND VERSION LOADED");

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

const rateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || "100", 10);
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(rateLimitMax) ? Math.max(10, rateLimitMax) : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP" },
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(express.json());

app.set("trust proxy", 1);
app.use(helmet());
app.use("/api", apiRateLimit);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "replace-me-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 10 * 60 * 1000,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

const PORT = process.env.PORT || 3001;
const CSV_PATH = path.join(__dirname, "All_Diets.csv");
const LOGIN_PROVIDERS = new Set(["google", "github"]);
const AUTH_TTL_MS = 5 * 60 * 1000;
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://red-meadow-0888e270f.2.azurestaticapps.net";

let cachedRows = null;
const authChallenges = new Map();

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
      },
    ),
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
      },
    ),
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
  for (const [challengeId, challenge] of authChallenges.entries()) {
    if (challenge.expiresAt <= now) {
      authChallenges.delete(challengeId);
    }
  }
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
        process.env.GOOGLE_CALLBACK_URL,
    );
  }

  if (provider === "github") {
    return Boolean(
      process.env.GITHUB_CLIENT_ID &&
        process.env.GITHUB_CLIENT_SECRET &&
        process.env.GITHUB_CALLBACK_URL,
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
        windowMs: 15 * 60 * 1000,
        max: apiRateLimit.max,
      },
      session: {
        enabled: true,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
      cors: {
        restricted: true,
        allowedOrigins,
      },
    },
  });
});

app.get("/api/auth/providers", (req, res) => {
  res.json({
    ok: true,
    providers: {
      google: providerConfigured("google"),
      github: providerConfigured("github"),
    },
    otpEmailConfigured: Boolean(mailer),
  });
});

app.get("/api/auth/oauth/:provider/start", (req, res, next) => {
  const provider = toLower(req.params.provider);
  if (!LOGIN_PROVIDERS.has(provider)) {
    return res.status(400).json({ ok: false, error: "Unsupported provider" });
  }

  if (!providerConfigured(provider)) {
    return res.status(503).json({
      ok: false,
      error: `${provider} OAuth is not configured on this server`,
    });
  }

  req.session.returnTo = String(req.query.returnTo || FRONTEND_URL);
  const authConfig = resolveAuthOptions(provider);
  return passport.authenticate(authConfig.strategy, authConfig.options)(
    req,
    res,
    next,
  );
});

app.get("/api/auth/oauth/google/callback", (req, res, next) => {
  passport.authenticate("google", async (err, user) => {
    const returnTo = req.session.returnTo || FRONTEND_URL;
    delete req.session.returnTo;

    if (err || !user) {
      return res.redirect(`${returnTo}?authError=oauth_failed`);
    }

    if (!user.email) {
      return res.redirect(`${returnTo}?authError=email_not_available`);
    }

    try {
      cleanupAuthChallenges();
      const challengeId = crypto.randomUUID();
      const code = generateSixDigitCode();

      authChallenges.set(challengeId, {
        provider: user.provider,
        code,
        expiresAt: Date.now() + AUTH_TTL_MS,
        user: {
          provider: user.provider,
          id: user.id,
          displayName: user.displayName,
          email: user.email,
        },
      });

      await sendOtpEmail(user.email, code, user.provider);

      return res.redirect(
        `${returnTo}?oauthChallenge=${encodeURIComponent(
          challengeId,
        )}&oauthProvider=${encodeURIComponent(
          user.provider,
        )}&oauthEmail=${encodeURIComponent(maskEmail(user.email))}`,
      );
    } catch (e) {
      return res.redirect(
        `${returnTo}?authError=${encodeURIComponent("otp_delivery_failed")}`,
      );
    }
  })(req, res, next);
});

app.get("/api/auth/oauth/github/callback", (req, res, next) => {
  passport.authenticate("github", async (err, user) => {
    const returnTo = req.session.returnTo || FRONTEND_URL;
    delete req.session.returnTo;

    if (err || !user) {
      return res.redirect(`${returnTo}?authError=oauth_failed`);
    }

    if (!user.email) {
      return res.redirect(`${returnTo}?authError=email_not_available`);
    }

    try {
      cleanupAuthChallenges();
      const challengeId = crypto.randomUUID();
      const code = generateSixDigitCode();

      authChallenges.set(challengeId, {
        provider: user.provider,
        code,
        expiresAt: Date.now() + AUTH_TTL_MS,
        user: {
          provider: user.provider,
          id: user.id,
          displayName: user.displayName,
          email: user.email,
        },
      });

      await sendOtpEmail(user.email, code, user.provider);

      return res.redirect(
        `${returnTo}?oauthChallenge=${encodeURIComponent(
          challengeId,
        )}&oauthProvider=${encodeURIComponent(
          user.provider,
        )}&oauthEmail=${encodeURIComponent(maskEmail(user.email))}`,
      );
    } catch (e) {
      return res.redirect(
        `${returnTo}?authError=${encodeURIComponent("otp_delivery_failed")}`,
      );
    }
  })(req, res, next);
});

app.post("/api/auth/2fa/verify", (req, res) => {
  try {
    cleanupAuthChallenges();

    const challengeId = String(req.body?.challengeId || "").trim();
    const code = String(req.body?.code || "").trim();

    if (!challengeId || !code) {
      return res.status(400).json({
        ok: false,
        error: "challengeId and code are required",
      });
    }

    const challenge = authChallenges.get(challengeId);
    if (!challenge) {
      return res.status(400).json({
        ok: false,
        error: "Invalid or expired challenge",
      });
    }

    if (challenge.code !== code) {
      return res.status(401).json({
        ok: false,
        error: "Invalid 2FA code",
      });
    }

    authChallenges.delete(challengeId);

    res.json({
      ok: true,
      message: `${challenge.provider} login successful`,
      user: challenge.user || {
        provider: challenge.provider,
        role: "student",
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
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
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 10));

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
    const rows = await loadCSV();
    const k = Math.min(10, Math.max(2, Number(req.query.k || 3)));

    if (!rows.length) {
      return res.json({ k, clusterCenters: [], sample: [] });
    }

    const X = rows.map((r) => [r.protein, r.carbs, r.fat]);
    const result = kmeans(X, k);

    const centers = result.centroids.map((c) =>
      c.map((v) => Number(v.toFixed(2))),
    );

    const sample = [];
    const limit = Math.min(50, rows.length);

    for (let i = 0; i < limit; i++) {
      sample.push({
        name: rows[i].name,
        dietType: rows[i].dietType,
        protein: rows[i].protein,
        carbs: rows[i].carbs,
        fat: rows[i].fat,
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CSV path: ${CSV_PATH}`);
});
