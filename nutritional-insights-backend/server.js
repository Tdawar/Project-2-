const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const KMeans = require("ml-kmeans");

const app = express();

console.log(" LATEST AZURE BACKEND VERSION LOADED");

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
  const cleaned = String(v).replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function avg(nums) {
  if (!nums.length) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

function detectDelimiter(filePath) {
  const head = fs.readFileSync(filePath, "utf8").slice(0, 5000);
  const firstLine = head.split(/\r?\n/)[0] || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

async function loadCSV() {
  if (cachedRows) return cachedRows;

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at: ${CSV_PATH}`);
  }

  const delimiter = detectDelimiter(CSV_PATH);
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(
        csv({
          separator: delimiter,
          mapHeaders: ({ header }) =>
            String(header || "").replace(/^\uFEFF/, "").trim(),
          mapValues: ({ value }) =>
            typeof value === "string" ? value.trim() : value,
        })
      )
      .on("data", (row) => {
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

        const protein = toNumber(
          row["Protein(g)"] ??
            row["Protein (g)"] ??
            row["Protein"] ??
            row["Protein(g) "]
        );

        const carbs = toNumber(
          row["Carbs(g)"] ??
            row["Carbs (g)"] ??
            row["Carbs"] ??
            row["Carbohydrates"]
        );

        const fat = toNumber(
          row["Fat(g)"] ??
            row["Fat (g)"] ??
            row["Fat"] ??
            row["Fats (g)"]
        );

        if (!diet || !recipe) return;

        rows.push({
          dietType: diet,
          diet,
          name: recipe,
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

  console.log("CSV loaded:", cachedRows.length);

  return cachedRows;
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Nutritional Insights Backend Running",
    csvFound: fs.existsSync(CSV_PATH),
  });
});

app.get("/api/insights", async (req, res) => {
  try {
    const rows = await loadCSV();

    const diets = {};
    rows.forEach((r) => {
      if (!diets[r.diet]) {
        diets[r.diet] = { protein: [], carbs: [], fat: [] };
      }
      diets[r.diet].protein.push(r.protein);
      diets[r.diet].carbs.push(r.carbs);
      diets[r.diet].fat.push(r.fat);
    });

    const result = Object.keys(diets).map((d) => ({
      diet: d,
      protein: avg(diets[d].protein),
      carbs: avg(diets[d].carbs),
      fat: avg(diets[d].fat),
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/recipes", async (req, res) => {
  try {
    const rows = await loadCSV();
    res.json(rows.slice(0, 20));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/clusters", async (req, res) => {
  try {
    const rows = await loadCSV();
    const k = 3;

    const X = rows.map((r) => [r.protein, r.carbs, r.fat]);
    const result = await KMeans(X, k);

    res.json({
      centers: result.centroids,
      sample: rows.slice(0, 20),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
