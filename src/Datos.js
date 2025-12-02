import React from "react";
import PropTypes from "prop-types";

const MetricItem = ({ label, value }) => (
  <div className="flex justify-between border-b border-gray-700 pb-1">
    <span className="text-gray-300">{label}</span>
    <span className="font-semibold">{value ?? 0}</span>
  </div>
);
const ExternalLinkIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const BugIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5"
  >
    <rect width="8" height="14" x="8" y="6" rx="4" />
    <path d="m19 13-3-2" />
    <path d="m5 13 3-2" />
    <path d="m19 9-3 2" />
    <path d="m5 9 3 2" />
    <path d="m19 17-3-2" />
    <path d="m5 17 3-2" />
    <path d="M12 2v4" />
    <path d="m15.5 2.5-1.5 2.5" />
    <path d="m8.5 2.5 1.5 2.5" />
  </svg>
);
const LinkButton = ({ url, label, icon: Icon, colorClass }) => {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`ml-2 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border ${colorClass}`}
      title={`Open ${label} in SonarCloud`}
    >
      <Icon />
      {label}
    </a>
  );
};

// Helper para colores SQALE
const getCriticalityBadge = (severity) => {
  if (!severity || severity === "NONE") return null;

  let colorClass = "bg-gray-500";
  let textClass = "text-white";
  let label = severity; // Usamos el nombre real (CRITICAL, HIGH...)

  switch (severity.toUpperCase()) {
    case "CRITICAL":
      // Rojo: Alta importancia, requiere mucha atención
      colorClass = "bg-red-600";
      break;
    case "HIGH":
      // Naranja: Importante
      colorClass = "bg-orange-500";
      break;
    case "MEDIUM":
      // Amarillo: Importancia media
      colorClass = "bg-yellow-500";
      textClass = "text-black"; // Texto oscuro para contraste
      break;
    case "LOW":
      // Verde/Azul: Menor impacto (Componente auxiliar)
      colorClass = "bg-emerald-500";
      break;
    default:
      return null;
  }

  return (
    <span
      className={`ml-2 text-xs uppercase font-bold px-2 py-0.5 rounded shadow-sm ${colorClass} ${textClass}`}
      title={`Nivel de Criticidad: ${severity} (Importancia en el sistema)`}
    >
      {label}
    </span>
  );
};

const Datos = ({ info, childrenNodes, criticalityFilter }) => {
  if (!info) return null;
  const formatFixed = (val) => (val != null ? val.toFixed(2) : 0);

  const formatCoverage = (val) => {
    if (val === undefined || val === null) return "...";
    if (val === -1) return "-"; // Si es -1, mostramos guión
    return `${val.toFixed(2)}%`;
  };

  const getCoverageColorClass = (val) => {
    if (val === undefined || val === null || val === -1) return "text-gray-500";
    if (val < 50) return "text-red-400";
    if (val < 80) return "text-yellow-400";
    return "text-emerald-400";
  };

  let currentSeverity = "NONE";
  if (criticalityFilter && criticalityFilter !== "none") {
    const key =
      criticalityFilter === "overall"
        ? "overall_severity"
        : `severity_${criticalityFilter}`;
    currentSeverity = info[key] || "NONE";
  }

  // Objeto de métricas principales
  const mainMetrics = [
    { label: "Lines of Code (LOC)", value: info.NOL },
    { label: "Complexity (Total)", value: info.total_complexity },
    { label: "Funciones", value: info.NOA },
    { label: "Métodos", value: info.NOM },
  ];

  // Objeto de métricas de evolución (Churn)
  const evolutionMetrics = [
    { label: "Churn (Total)", value: info.total_churn },
    { label: "Frecuencia (Commits)", value: info.total_frequency },
    { label: "Autores", value: info.total_authors },
  ];

  // Métricas de Halstead
  const halsteadMetrics = [
    { label: "Volumen", value: formatFixed(info.total_halstead_volume) },
    { label: "Dificultad", value: formatFixed(info.total_halstead_difficulty) },
    { label: "Esfuerzo", value: formatFixed(info.total_halstead_effort) },
    { label: "Bugs (Estimados)", value: formatFixed(info.total_halstead_bugs) },
  ];

  // Métricas de Acoplamiento y Cobertura
  const qualityMetrics = [
    { label: "Acoplamiento (Deps)", value: info.total_coupling_deps },
    { label: "Issues (Lint)", value: info.total_issues },
    { label: "Coverage", value: formatCoverage(info.coverage) },
  ];

  return (
    <div className="bg-gray-900 text-white shadow-inner w-full h-full flex overflow-hidden">
      {/* --- IZQUIERDA (50%): Métricas y Encabezado --- */}
      <div className="w-1/2 flex flex-col border-gray-700 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-3 flex-none flex flex-wrap items-center">
          {info.name || "Root"}
          <span className="ml-2 text-gray-400">[{info.type}]</span>
          {/* Badge SQALE */}
          {criticalityFilter !== "none" && getCriticalityBadge(currentSeverity)}
          <div className="flex items-center ml-auto lg:ml-2 gap-2 mt-1 lg:mt-0">
            {/* Botón Issues */}
            <LinkButton
              url={info.issues_url}
              label="Issues"
              icon={BugIcon}
              colorClass="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300"
            />

            {/* Botón Coverage/Sonar */}
            <LinkButton
              url={info.sonar_url}
              label="Cobertura"
              icon={ExternalLinkIcon}
              colorClass="border-blue-500/50 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
            />
          </div>
        </h2>

        <div className="flex-1">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            {/* Grupo 1 */}
            <div>
              <h3 className="text-xs font-semibold text-gray-100 uppercase mb-2">
                Dimensiones
              </h3>
              <div className="space-y-2">
                {mainMetrics.map((m) => (
                  <MetricItem key={m.label} {...m} />
                ))}
              </div>
            </div>

            {/* Grupo 2 */}
            <div>
              <h3 className="text-xs font-semibold text-gray-100 uppercase mb-2">
                Calidad
              </h3>
              <div className="space-y-1">
                {qualityMetrics.map((m) => (
                  <MetricItem key={m.label} {...m} />
                ))}
              </div>
            </div>

            {/* Grupo 3 */}
            <div>
              <h3 className="text-xs font-semibold text-gray-100 uppercase mb-2">
                Evolución
              </h3>
              <div className="space-y-1">
                {evolutionMetrics.map((m) => (
                  <MetricItem key={m.label} {...m} />
                ))}
              </div>
            </div>

            {/* Grupo 4 */}
            <div>
              <h3 className="text-xs font-semibold text-gray-100 uppercase mb-2">
                Halstead
              </h3>
              <div className="space-y-1">
                {halsteadMetrics.map((m) => (
                  <MetricItem key={m.label} {...m} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- DERECHA (50%): Contenido del Directorio --- */}
      <div className="w-1/2 flex flex-col bg-gray-900 p-4 overflow-y-auto">
        {childrenNodes && childrenNodes.length > 0 ? (
          <>
            <h3 className="text-md font-semibold mb-2 text-gray-300 flex-none">
              Contenido del Directorio
            </h3>
            <div className="flex-1 border border-gray-700 rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-700 text-sm overflow-y-auto h-full scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                {childrenNodes.map((child, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between px-3 py-2 hover:bg-gray-800"
                  >
                    <span className="truncate">
                      <span className="font-medium">{child.name}</span>{" "}
                      <span className="text-gray-400">[{child.type}]</span>
                    </span>
                    <span
                      className={`font-mono font-bold text-right shrink-0 ${getCoverageColorClass(
                        child.coverage
                      )}`}
                    >
                      {formatCoverage(child.coverage)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 italic">
            Carpeta vacía o sin hijos visibles.
          </div>
        )}
      </div>
    </div>
  );
};

Datos.propTypes = {
  info: PropTypes.shape({
    NOL: PropTypes.number,
    NOM: PropTypes.number,
    NOA: PropTypes.number,
    name: PropTypes.string,
    type: PropTypes.string,
    url: PropTypes.string,
    sonar_url: PropTypes.string,
    issues_url: PropTypes.string,
    total_issues: PropTypes.number,
    total_complexity: PropTypes.number,
    total_churn: PropTypes.number,
    total_coupling_deps: PropTypes.number,
    coverage: PropTypes.number,
    total_frequency: PropTypes.number,
    total_authors: PropTypes.number,
    total_halstead_volume: PropTypes.number,
    total_halstead_difficulty: PropTypes.number,
    total_halstead_effort: PropTypes.number,
    total_halstead_bugs: PropTypes.number,
  }),
  childrenNodes: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      type: PropTypes.string,
    })
  ),
  criticalityFilter: PropTypes.string,
};

MetricItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

LinkButton.propTypes = {
  url: PropTypes.string,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired, // Valida que sea un componente React (el SVG)
  colorClass: PropTypes.string.isRequired,
};
export default Datos;
