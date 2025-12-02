// src/TimelineBarChart.js
import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import PropTypes from "prop-types";

// --- Constantes de Color ---
const COLOR_BAR = "rgba(59, 130, 246, 0.7)"; // Azul
const COLOR_BAR_BG = "rgba(59, 130, 246, 0.2)";
const COLOR_SELECTED = "rgba(34, 211, 238, 1)"; // Cyan
const COLOR_SELECTED_BG = "rgba(34, 211, 238, 0.4)";
const COLOR_ZERO = "rgba(107, 114, 128, 0.2)"; // Gris
const COLOR_GRID = "rgba(255, 255, 255, 0.1)";
const COLOR_TEXT = "#fff";

function TimelineBarChart({
  manifest,
  timelineData,
  selectedSha,
  onShaSelect,
  isExpanded,
}) {
  // 1. Procesa los datos para el gráfico
  const chartData = useMemo(() => {
    // Crea un mapa de búsqueda rápida para el 'loc' desde el timeline
    const locMap = new Map(
      timelineData.map((d) => [d.sha_text, d.loc === 0 ? 0.1 : d.loc]) // 0.1 para que aparezca una barra mínima
    );

    // Mapea el manifest (que está ordenado de nuevo a viejo)
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];

    // Recorre el manifest en reversa para que el gráfico sea de viejo a nuevo
    for (let i = manifest.length - 1; i >= 0; i--) {
      const sha = manifest[i];
      const loc = locMap.get(sha.sha_text) ?? 0; // 0 si no existe

      labels.push(sha.sha_text); // Usamos el SHA como ID
      data.push(loc);

      // Colorea la barra seleccionada
      if (sha.sha_text === selectedSha) {
        backgroundColors.push(COLOR_SELECTED_BG);
        borderColors.push(COLOR_SELECTED);
      } else if (loc === 0) {
        backgroundColors.push(COLOR_ZERO);
        borderColors.push(COLOR_ZERO);
      } else {
        backgroundColors.push(COLOR_BAR_BG);
        borderColors.push(COLOR_BAR);
      }
    }

    return {
      labels,
      datasets: [
        {
          label: "Líneas de Código (LOC)",
          data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          barPercentage: 0.9,
          categoryPercentage: 0.9,
        },
      ],
    };
  }, [manifest, timelineData, selectedSha]);

  // 2. Busca los datos del SHA seleccionado para mostrar abajo
  const selectedShaData = useMemo(() => {
    return manifest.find((d) => d.sha_text === selectedSha);
  }, [manifest, selectedSha]);

  // 3. Opciones del gráfico
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "x",
    plugins: {
      legend: {
        display: false, // Oculta la leyenda
      },
      tooltip: {
        enabled: true, // Habilita tooltips
        callbacks: {
          title: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex;
            const sha = chartData.labels[index];
            return `SHA: ${sha.substring(0, 9)}`;
          },
          label: (ctx) => {
            const loc = ctx.raw === 0.1 ? 0 : ctx.raw;
            return `LOC: ${loc}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        type: "logarithmic", // Normaliza la altura para que LOC 100 y 100,000 quepan
        min: 0.1, // Mínimo para que funcione el logarítmico
        ticks: {
          color: isExpanded ? COLOR_TEXT : "transparent",
          font: { size: 10 },
          callback: (value) => {
            if (
              value === 1 ||
              value === 10 ||
              value === 100 ||
              value === 1000 ||
              value === 10000 ||
              value === 100000
            ) {
              return value;
            }
            if (value === 0.1) return 0;
            return null;
          },
        },
        grid: { color: isExpanded ? COLOR_GRID : "transparent" },
      },
      x: {
        ticks: {
          display: false, // Oculta las etiquetas de SHA del eje X
        },
        grid: { display: false },
      },
    },
    onClick: (evt, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const sha = chartData.labels[index];
        const loc = chartData.datasets[0].data[index];
        // Solo permite cambiar si la barra no es 0
        if (loc > 0 && sha !== selectedSha) {
          onShaSelect(sha);
        }
      }
    },
  };

  // 4. Renderizado
  return (
    <div
      className={`w-full h-full p-4 flex flex-col ${
        isExpanded ? "bg-gray-900 text-white  rounded-xl" : "bg-transparent"
      }`}
    >
      {/* 1. El Gráfico de Barras */}
      <div className="flex-1 w-full h-3/4">
        <Bar data={chartData} options={options} />
      </div>

      {/* 2. La Información del SHA */}
      {selectedShaData && (
        <div
          className={`flex-none h-1/4 pt-2 text-center ${
            isExpanded ? "text-gray-400 " : "text-white text-shadow-lg"
          }`}
        >
          <p
            className={`text-xs font-mono truncate ${
              isExpanded ? "text-gray-300" : "text-white font-semibold"
            }`}
          >
            {selectedShaData.author_name}
          </p>
          <p className="text-xs">
            {new Date(selectedShaData.commit_date).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

TimelineBarChart.propTypes = {
  manifest: PropTypes.array.isRequired,
  timelineData: PropTypes.array.isRequired,
  selectedSha: PropTypes.string,
  onShaSelect: PropTypes.func.isRequired,
  isExpanded: PropTypes.bool.isRequired,
};

export default TimelineBarChart;
