import React, { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import PropTypes from "prop-types";

const THEME = {
  current: {
    normal: {
      text: "text-emerald-400",
      bg: "bg-emerald-500",
      hex: "#34d399", // emerald-400 para chart
    },
    critical: {
      text: "text-red-500",
      bg: "bg-red-600",
      hex: "#ef4444", // red-500 para chart
    },
  },
  global: {
    normal: {
      text: "text-blue-400",
      bg: "bg-blue-600",
    },
    critical: {
      text: "text-amber-400",
      bg: "bg-amber-500",
    },
  },
};

const CompactBar = ({ label, value, colorClass, valueColorClass }) => {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center justify-between text-xs mb-1">
      <div className="flex items-center gap-2 w-full">
        <span className="text-gray-400 w-28 truncate" title={label}>
          {label}
        </span>
        <div className="flex-1 bg-gray-700 rounded-full h-1.5 mx-2">
          <div
            className={`h-1.5 rounded-full ${colorClass} transition-all duration-500`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
        <span className={`font-bold w-10 text-right ${valueColorClass}`}>
          {value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};
CompactBar.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number,
  colorClass: PropTypes.string.isRequired,
  valueColorClass: PropTypes.string.isRequired,
};

const TrendItem = ({ label, value, colorClass }) => {
  const symbol = value > 0 ? "+" : "";
  return (
    <div className="text-center min-w-[70px]">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5 font-semibold">
        {label}
      </p>
      <p className={`text-xl font-black leading-none ${colorClass}`}>
        {symbol}
        {value}%
      </p>
    </div>
  );
};
TrendItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  colorClass: PropTypes.string,
};

export default function SidePanel({
  globalStats,
  rootInfo,
  isNightMode,
  criticalityFilter,
  timelineData,
  currentShaDate,
  onClose,
}) {
  const [range, setRange] = useState("all");

  const getMetricKey = () => {
    if (
      !criticalityFilter ||
      criticalityFilter === "none" ||
      criticalityFilter === "overall"
    ) {
      return "debt_cov_overall";
    }
    return `debt_cov_${criticalityFilter}`;
  };
  const currentMetricKey = getMetricKey();
  const metricLabel =
    criticalityFilter === "none"
      ? "Overall"
      : criticalityFilter.charAt(0).toUpperCase() + criticalityFilter.slice(1);

  const { filteredData, currentPoint } = useMemo(() => {
    if (!timelineData || timelineData.length === 0)
      return { filteredData: [], currentPoint: null };

    const sortedData = [...timelineData].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    const current = sortedData.find((d) => d.date === currentShaDate);

    const lastDate = new Date(sortedData[sortedData.length - 1].date);
    let cutoff = new Date(lastDate);

    switch (range) {
      case "day":
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case "7d":
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case "month":
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
      case "3m":
        cutoff.setMonth(cutoff.getMonth() - 3);
        break;
      case "6m":
        cutoff.setMonth(cutoff.getMonth() - 6);
        break;
      case "1y":
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        break;
      default:
        cutoff = new Date(0);
    }

    return {
      filteredData: sortedData.filter((d) => new Date(d.date) >= cutoff),
      currentPoint: current,
    };
  }, [range, timelineData, currentShaDate]);

  const globalAvg = globalStats?.avg_coverage || 0;
  const globalCrit = globalStats ? globalStats[currentMetricKey] : null;

  const rootName = rootInfo?.name || "Root";
  const rootAvg = rootInfo?.coverage || 0;
  const rootCrit = rootInfo ? rootInfo[currentMetricKey] : null;

  const calculateTrend = (key) => {
    if (filteredData.length < 2) return 0;
    const first = filteredData[0][key] || 0;
    const last = filteredData[filteredData.length - 1][key] || 0;
    return +(last - first).toFixed(1);
  };
  const trendNormal = calculateTrend("coverage");
  const trendCritical = calculateTrend(currentMetricKey);

  const lineData = {
    labels: filteredData.map((d) => new Date(d.date)),
    datasets: [
      {
        label: "Coverage",
        data: filteredData.map((d) => d.coverage),
        borderColor: THEME.current.normal.hex,
        backgroundColor: THEME.current.normal.hex,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: THEME.current.normal.hex,
        tension: 0.2,
      },
      {
        label: `Critical`,
        data: filteredData.map((d) => d[currentMetricKey]),
        borderColor: THEME.current.critical.hex,
        backgroundColor: THEME.current.critical.hex,
        borderWidth: 2,
        borderDash: [3, 3],
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: THEME.current.critical.hex,
        tension: 0.2,
        spanGaps: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    scales: {
      y: {
        // CORRECCIÓN: Eliminamos min: 0 y max: 100 fijos.
        // 'grace' agrega un margen del 5% arriba y abajo para que el gráfico no se vea apretado.
        grace: "5%",
        beginAtZero: false, // Importante: Permite que el eje empiece cerca del valor mínimo (ej. 90)
        ticks: { color: "#6b7280", font: { size: 10 } },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      x: {
        type: "time",
        time: {
          unit: range === "day" ? "hour" : "day",
          displayFormats: { hour: "HH:mm", day: "MM/dd" },
        },
        ticks: { color: "#9ca3af", maxTicksLimit: 6 },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { labels: { color: "#fff", boxWidth: 10 } },
      annotation: {
        annotations: {
          line1: {
            type: "line",
            xMin: currentPoint
              ? new Date(currentPoint.date).getTime()
              : undefined,
            xMax: currentPoint
              ? new Date(currentPoint.date).getTime()
              : undefined,
            borderColor: "rgba(255,255,255,0.6)", // Un poco más sutil
            borderWidth: 1,
            borderDash: [4, 4], // Guiones más separados para ver mejor detrás
            label: {
              display: true,
              content: "Actual",
              position: "end", // Colocar en la parte superior
              rotation: -90, // Rotar texto verticalmente
              backgroundColor: "rgba(0,0,0,0.3)", // Fondo semi-transparente
              color: "rgba(255,255,255,0.9)",
              font: { size: 9 },
              // Ajustes finos de posición:
              yAdjust: 20, // Bajarlo un poco del borde superior
              xAdjust: -12, // Moverlo a la izquierda de la línea para no tapar el punto
              borderRadius: 2,
            },
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${
              ctx.raw != null ? ctx.raw.toFixed(1) + "%" : "N/A"
            }`,
        },
      },
    },
  };

  const coverageDebt =
    rootCrit !== null && rootCrit !== undefined
      ? (100 - rootCrit).toFixed(1)
      : null;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white px-4 py-3 overflow-hidden">
      <div className="mb-3 flex-none">
        <h2 className="text-lg font-bold text-gray-200 uppercase tracking-wide">
          Análisis de Cobertura
        </h2>
      </div>

      {/* --- GRID DE MÉTRICAS --- */}
      <div className="grid grid-cols-2 gap-4 mb-3 flex-none">
        <div className="space-y-4 pr-2 border-r border-gray-800">
          {/* Global (Contexto - Azul/Ambar) */}
          <div>
            <h3 className="text-[10px] text-gray-500 font-bold mb-1 uppercase">
              Global Repositorio
            </h3>
            <CompactBar
              label="Normal"
              value={globalAvg}
              colorClass={THEME.global.normal.bg}
              valueColorClass={THEME.global.normal.text}
            />
            <CompactBar
              label={`Crit. (${metricLabel})`}
              value={globalCrit}
              colorClass={THEME.global.critical.bg}
              valueColorClass={THEME.global.critical.text}
            />
          </div>

          {/* Local (Foco - Verde/Rojo) */}
          <div>
            <h3 className="text-[10px] text-white font-bold mb-1 uppercase truncate flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {rootName}
            </h3>
            <CompactBar
              label="Normal"
              value={rootAvg}
              colorClass={THEME.current.normal.bg}
              valueColorClass={THEME.current.normal.text}
            />
            <CompactBar
              label={`Crit. (${metricLabel})`}
              value={rootCrit}
              colorClass={THEME.current.critical.bg}
              valueColorClass={THEME.current.critical.text}
            />
          </div>
        </div>

        {/* COLUMNA 2: TRENDS + SELECTOR + DEUDA */}
        <div className="flex flex-col gap-3 pl-2">
          <div className="bg-gray-800/40 p-3 rounded-lg border border-gray-700/50 flex items-end justify-between">
            <TrendItem
              label="Cov."
              value={trendNormal}
              colorClass={THEME.current.normal.text}
            />

            <TrendItem
              label={`Crit. (${metricLabel})`}
              value={trendCritical}
              colorClass={THEME.current.critical.text}
            />

            <div className="text-center min-w-[70px]">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 font-semibold">
                Rango
              </p>
              <select
                className="bg-gray-900 text-lg font-black px-1 py-0 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-gray-300 cursor-pointer w-full text-center"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="day">24h</option>
                <option value="7d">7d</option>
                <option value="month">30d</option>
                <option value="3m">3m</option>
                <option value="6m">6m</option>
                <option value="1y">1y</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {coverageDebt !== null ? (
            <div className="mt-auto text-center p-2 bg-red-900/10 rounded border border-red-500/20">
              <p className="text-xs text-red-300 uppercase mb-0.5 font-semibold">
                Deuda ({metricLabel})
              </p>
              <p className="text-2xl font-black text-red-500 leading-none">
                {coverageDebt}%
              </p>
            </div>
          ) : (
            <div className="mt-auto flex items-center justify-center p-3 text-xs text-gray-600 italic border border-gray-800 rounded h-full">
              Sin datos críticos
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">
          Evolución Histórica (Coverage vs Critical)
        </h3>
        <div className="h-64 w-full">
          {timelineData.length > 0 ? (
            <Line data={lineData} options={options} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Sin datos históricos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

SidePanel.propTypes = {
  globalStats: PropTypes.object,
  rootInfo: PropTypes.object,
  isNightMode: PropTypes.bool,
  criticalityFilter: PropTypes.string,
  timelineData: PropTypes.array.isRequired,
  currentShaDate: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
