import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import ChartsGrid from "./components/ChartsGrid";
import Filters from "./components/Filters";
import ApiButtons from "./components/ApiButtons";
import Pagination from "./components/Pagination";
import RecipesList from "./components/RecipesList";
import ClustersList from "./components/Clusterslist";
import InsightsSummary from "./components/InsightsSummary";
import Spinner from "./components/Spinner";

/* Backend API */
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  // Fallback keeps production endpoint when no local env override is set.
  "https://nutritional-insights-api-2-evd5cncgbbc9epce.canadacentral-01.azurewebsites.net";

/* Generic API fetch */
async function apiGet(endpoint, params) {
  const url = new URL(`${API_BASE}${endpoint}`);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export default function App() {
  const [search, setSearch] = useState("");
  const [dietType, setDietType] = useState("all");
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [active, setActive] = useState("insights");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(
    // Memoized params prevent unnecessary callback/effect re-runs.
    () => ({
      q: search,
      dietType,
      page,
      pageSize: 10,
    }),
    [search, dietType, page],
  );

  /* Fetch Insights */
  const fetchInsights = useCallback(async () => {
    setActive("insights");
    setLoading(true);
    setError("");

    try {
      const json = await apiGet("/api/insights", params);
      setData(json);
    } catch (e) {
      setError(e.message || "Failed to fetch insights");
    } finally {
      setLoading(false);
    }
  }, [params]);

  /* Fetch Recipes */
  const fetchRecipes = useCallback(async () => {
    setActive("recipes");
    setLoading(true);
    setError("");

    try {
      const json = await apiGet("/api/recipes", params);
      setData(json);
    } catch (e) {
      setError(e.message || "Failed to fetch recipes");
    } finally {
      setLoading(false);
    }
  }, [params]);

  /* Fetch Clusters */
  const fetchClusters = useCallback(async () => {
    setActive("clusters");
    setLoading(true);
    setError("");

    try {
      const json = await apiGet("/api/clusters", params);
      setData(json);
    } catch (e) {
      setError(e.message || "Failed to fetch clusters");
    } finally {
      setLoading(false);
    }
  }, [params]);

  /* Auto refresh insights when filters change */
  useEffect(() => {
    if (active === "insights") {
      fetchInsights();
    }
  }, [active, fetchInsights]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="container mx-auto p-6">
        {/* Insights */}
        {active === "insights" && data && (
          <>
            <InsightsSummary summary={data.summary} />
            <ChartsGrid data={data} />
          </>
        )}

        {/* Filters */}
        <section className="my-8">
          <h2 className="text-2xl font-semibold mb-4">
            Filters and Data Interaction
          </h2>

          <Filters
            search={search}
            setSearch={setSearch}
            dietType={dietType}
            setDietType={(value) => {
              setDietType(value);
              setPage(1);
            }}
          />

          <div className="text-xs text-gray-500 mt-2">
            Insights auto-refresh. Recipes and Clusters require button click.
          </div>
        </section>

        {/* API Buttons */}
        <section className="my-8">
          <h2 className="text-2xl font-semibold mb-4">API Data Interaction</h2>

          <ApiButtons
            onInsights={fetchInsights}
            onRecipes={fetchRecipes}
            onClusters={fetchClusters}
            disabled={loading}
          />

          {loading && <Spinner />}

          {error && <div className="text-red-600 text-sm mt-3">{error}</div>}
        </section>

        {/* Recipes */}
        {data && active === "recipes" && <RecipesList recipes={data.recipes} />}

        {/* Clusters */}
        {data && active === "clusters" && (
          <ClustersList clusters={data.sample} />
        )}

        {/* Pagination */}
        <section className="my-10">
          <h2 className="text-2xl font-semibold mb-4">Pagination</h2>

          <Pagination
            page={page}
            total={data?.meta?.total || 0}
            pageSize={data?.meta?.pageSize || 10}
            onSet={(p) => setPage(p)}
          />

          <div className="text-xs text-gray-500 mt-2">
            Pagination uses backend meta.total.
          </div>
        </section>
      </main>

      <footer className="bg-blue-600 p-4 text-white text-center mt-10">
        © 2025 Nutritional Insights
      </footer>
    </div>
  );
}
