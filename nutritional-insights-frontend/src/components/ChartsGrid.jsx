import React, { useMemo } from "react";
import { Bar, Pie, Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import Heatmap from "./Heatmap";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  Tooltip,
  Legend
);

export default function ChartsGrid({ data }) {
  // ✅ If backend sends chart-ready objects, we use them.
  // ✅ If backend isn't ready, we use demo data so UI still looks complete.

  const PIE_COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
  ];

  const fallback = useMemo(() => {
    const barData = {
      labels: ["Vegan", "Keto", "Paleo"],
      datasets: [
        { label: "Protein", data: [20, 30, 25], backgroundColor: "rgba(59,130,246,0.7)" },
        { label: "Carbs",   data: [50, 10, 35], backgroundColor: "rgba(16,185,129,0.7)" },
        { label: "Fat",     data: [15, 60, 30], backgroundColor: "rgba(245,158,11,0.7)" },
      ],
    };

    const scatterData = {
      datasets: [
        {
          label: "Protein vs Carbs",
          data: [
            { x: 20, y: 30 },
            { x: 50, y: 10 },
            { x: 35, y: 25 },
          ],
          backgroundColor: "rgba(59,130,246,0.7)",
        },
      ],
    };

    const pieData = {
      labels: ["Vegan", "Keto", "Paleo"],
      datasets: [{ data: [14, 9, 7], backgroundColor: PIE_COLORS }],
    };

    const heatmap = {
      labels: ["Calories", "Protein", "Carbs", "Fat"],
      values: [
        [1, 0.4, 0.6, 0.7],
        [0.4, 1, 0.2, 0.3],
        [0.6, 0.2, 1, 0.5],
        [0.7, 0.3, 0.5, 1],
      ],
    };

    return { barData, scatterData, pieData, heatmap };
  }, []);

  // Use backend data if present, else fallback
  const rawBar = data?.barData ?? fallback.barData;
  const rawPie = data?.pieData ?? fallback.pieData;
  const scatterData = data?.scatterData ?? fallback.scatterData;
  const heatmapData = data?.heatmap ?? fallback.heatmap;

  // Inject colors so charts are always visible
  const barData = {
    ...rawBar,
    datasets: rawBar.datasets.map((ds, i) => ({
      ...ds,
      backgroundColor: ds.backgroundColor ?? [
        "rgba(59,130,246,0.7)",
        "rgba(16,185,129,0.7)",
        "rgba(245,158,11,0.7)",
        "rgba(239,68,68,0.7)",
      ][i % 4],
    })),
  };

  const pieData = {
    ...rawPie,
    datasets: rawPie.datasets.map((ds) => ({
      ...ds,
      backgroundColor: ds.backgroundColor ?? PIE_COLORS,
    })),
  };

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">
        Explore Nutritional Insights
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Bar */}
        <div className="bg-white p-4 shadow-lg rounded-lg">
          <h3 className="font-semibold">Bar Chart</h3>
          <p className="text-sm text-gray-600">
            Average macronutrient content by diet type.
          </p>
          <div className="h-48 mt-2">
            <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        {/* Scatter */}
        <div className="bg-white p-4 shadow-lg rounded-lg">
          <h3 className="font-semibold">Scatter Plot</h3>
          <p className="text-sm text-gray-600">
            Nutrient relationships (protein vs carbs).
          </p>
          <div className="h-48 mt-2">
            <Scatter
              data={scatterData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { title: { display: true, text: "Carbs" } },
                  y: { title: { display: true, text: "Protein" } },
                },
              }}
            />
          </div>
        </div>

        {/* Heatmap */}
        <div className="bg-white p-4 shadow-lg rounded-lg">
          <h3 className="font-semibold">Heatmap</h3>
          <p className="text-sm text-gray-600">Nutrient correlations.</p>
          <div className="h-48 mt-2">
            <Heatmap labels={heatmapData.labels} values={heatmapData.values} />
          </div>
        </div>

        {/* Pie */}
        <div className="bg-white p-4 shadow-lg rounded-lg">
          <h3 className="font-semibold">Pie Chart</h3>
          <p className="text-sm text-gray-600">
            Recipe distribution by diet type.
          </p>
          <div className="h-48 mt-2">
            <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>
    </section>
  );
}