const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const KMeans = require("ml-kmeans");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CSV_PATH = path.join(__dirname, "All_Diets.csv");

// --------------------------- CSV Cache ---------------------------
let cachedRows = null;

function toLower(s) {
  return String(s || "").toLowerCase().trim();
}

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  // handle numbers like "12,34" (comma decimal) safely
  const cleaned = String(v).replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function avg(nums) {
  if (!nums.length) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

// Detect delimiter from first line
function detectDelimiter(filePath) {
  const head = fs.readFileSync(filePath, "utf8").slice(0, 5000);
  const firstLine = head.split(/\r?\n/)[0] || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

async function loadCSV() {
  // If cached but empty due to previous bad parse, allow reload by restarting server.
  if (cachedRows) return cachedRows;

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`❌ All_Diets.csv not found at: ${CSV_PATH}`);
  }

  const delimiter = detectDelimiter(CSV_PATH);
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH, { encoding: "utf8" })
      .pipe(
        csv({
          separator: delimiter,
          skipLines: 0,
          mapHeaders: ({ header }) => {
            // Remove BOM + trim spaces
            return String(header || "")
              .replace(/^\uFEFF/, "")
              .trim();
          },
          mapValues: ({ value }) => (typeof value === "string" ? value.trim() : value),
        })
      )
      .on("data", (row) => {
        // Support multiple possible header variants
        const diet =
          (row["Diet_type"] ||
            row["Diet Type"] ||
            row["diet_type"] ||
            row["diet"])?.trim() || "";

        const recipe =
          (row["Recipe_name"] ||
            row["Recipe Name"] ||
            row["recipe_name"] ||
            row["name"])?.trim() || "";

        const cuisine =
          (row["Cuisine_type"] ||
            row["Cuisine Type"] ||
            row["cuisine_type"] ||
            row["cuisine"])?.trim() || "Unknown";

        // Nutrition fields (cover common header spellings)
        const protein = toNumber(
          row["Protein(g)"] ??
            row["Protein (g)"] ??
            row["Protein(g) "] ??
            row["Protein (g) "] ??
            row["Protein"]
        );

        const carbs = toNumber(
          row["Carbs(g)"] ??
            row["Carbs (g)"] ??
            row["Carbs"] ??
            row["Carbohydrates (g)"] ??
            row["Carbohydrates"]
        );

        const fat = toNumber(
          row["Fat(g)"] ??
            row["Fat (g)"] ??
            row["Fat"] ??
            row["Fats (g)"]
        );

        // Keep only valid rows
        if (!diet || !recipe) return;

        rows.push({
          dietType: diet,
          diet: diet,
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

  // ✅ Debug logs so you can confirm instantly
  console.log("✅ CSV loaded");
  console.log("Delimiter detected:", delimiter);
  console.log("Rows loaded:", cachedRows.length);
  console.log("Sample row:", cachedRows[0]);

  return cachedRows;
}

// --------------------------- Correlation helpers (Heatmap) ---------------------------
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function corr(a, b) {
  if (!a.length || !b.length) return 0;

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

// --------------------------- Routes ---------------------------
app.get("/", async (req, res) => {
  res.json({
    ok: true,
    message: "Nutritional Insights Backend Running (CSV Mode - Fixed Parser)",
    csvFound: fs.existsSync(CSV_PATH),
  });
});

app.get("/api/insights", async (req, res) => {
  try {
    const dietType = toLower(req.query.dietType || "all");
    const q = toLower(req.query.q || "");
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 10));

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
          toLower(r.cuisine_type).includes(q)
      );
    }

    const map = new Map();
    for (const r of filtered) {
      const key = r.diet;
      if (!map.has(key)) {
        map.set(key, { count: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
      const agg = map.get(key);
      agg.count += 1;
      agg.calories += r.calories;
      agg.protein += r.protein;
      agg.carbs += r.carbs;
      agg.fat += r.fat;
    }

    const docs = Array.from(map.entries())
      .map(([diet, agg]) => ({
        diet,
        calories: Math.round(agg.calories / agg.count),
        protein: Number((agg.protein / agg.count).toFixed(2)),
        carbs: Number((agg.carbs / agg.count).toFixed(2)),
        fat: Number((agg.fat / agg.count).toFixed(2)),
        count: agg.count,
      }))
      .sort((a, b) => a.diet.localeCompare(b.diet));

    const barData = {
      labels: docs.map((d) => d.diet),
      datasets: [
        { label: "Protein", data: docs.map((d) => d.protein) },
        { label: "Carbs", data: docs.map((d) => d.carbs) },
        { label: "Fat", data: docs.map((d) => d.fat) },
      ],
    };

    const scatterData = {
      datasets: [
        {
          label: "Protein vs Carbs",
          data: docs.map((d) => ({ x: d.carbs, y: d.protein })),
        },
      ],
    };

    const pieData = {
      labels: docs.map((d) => d.diet),
      datasets: [{ data: docs.map((d) => d.count) }],
    };

    const p = filtered.map((r) => r.protein);
    const c = filtered.map((r) => r.carbs);
    const f = filtered.map((r) => r.fat);

    const heatmap = {
      labels: ["Protein", "Carbs", "Fat"],
      values: [
        [1, Number(corr(p, c).toFixed(3)), Number(corr(p, f).toFixed(3))],
        [Number(corr(c, p).toFixed(3)), 1, Number(corr(c, f).toFixed(3))],
        [Number(corr(f, p).toFixed(3)), Number(corr(f, c).toFixed(3)), 1],
      ],
    };

    const summary = {
      totalDietTypes: docs.length,
      avgCalories: avg(docs.map((d) => d.calories)),
      avgProtein: avg(docs.map((d) => d.protein)),
      avgCarbs: avg(docs.map((d) => d.carbs)),
      avgFat: avg(docs.map((d) => d.fat)),
      bestHighProtein: docs.slice().sort((a, b) => b.protein - a.protein)[0]?.diet || null,
      bestLowCarb: docs.slice().sort((a, b) => a.carbs - b.carbs)[0]?.diet || null,
    };

    res.json({
      barData,
      scatterData,
      pieData,
      heatmap,
      summary,
      meta: { page, pageSize, total: docs.length, dietType, q },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
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
      filtered = filtered.filter((r) => toLower(r.name).includes(q));
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
    res.status(500).json({ ok: false, error: e.message });
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
    const result = await KMeans(X, k);

    const centers = result.centroids.map((c) =>
      c.centroid.map((v) => Number(v.toFixed(2)))
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

    res.json({ k, clusterCenters: centers, sample });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📄 CSV path: ${CSV_PATH}`);
});