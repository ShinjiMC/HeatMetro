// src/CityView.js
import React from "react";
import PropTypes from "prop-types";
import Loading from "./Loading";
import CityPlotter from "./CityPlotter"; // Importa el plotter
import Datos from "./Datos";
import SidePanel from "./SidePanel";
import TimelineBarChart from "./TimelineBarChart";

// --- Iconos para los botones (extraídos para limpieza) ---
const BackIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const SunIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
  >
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);
const MoonIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
  >
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);
const AnalyticsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3v18h18M7 13h10M7 9h10M7 17h10"
    />
  </svg>
);

const CRITICALITY_FILTERS = [
  { key: "none", label: "None" },
  { key: "overall", label: "Overall" },
  { key: "complexity", label: "Complexity" },
  { key: "coupling", label: "Coupling" },
  { key: "issues", label: "Issues" },
  { key: "churn", label: "Churn" },
  { key: "authors", label: "Authors" },
  { key: "halstead", label: "Halstead" },
];

const CriticalityFilter = ({ currentFilter, onChange }) => (
  <select
    id="crit-filter"
    value={currentFilter}
    onChange={(e) => onChange(e.target.value)}
    className="z-50 bg-gray-800 text-white text-sm rounded-lg px-3 py-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg"
    aria-label="Highlight criticality filter"
  >
    {CRITICALITY_FILTERS.map((f) => (
      <option key={f.key} value={f.key}>
        {f.label}
      </option>
    ))}
  </select>
);
CriticalityFilter.propTypes = {
  currentFilter: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

// --- Componente de Vista ---
const CityView = ({
  // Estado
  loading,
  parentStack,
  isNightMode,
  sidePanelOpen,
  rootInfo,
  rootChildren,
  analyticsData,
  plotData,
  // Handlers
  criticalityFilter,
  onGoBack,
  onToggleMode,
  onToggleAnalytics,
  onFilterChange,
  onSceneMount,
  onMeshClick,
  onMeshHover,
  onMeshOut,
  manifest,
  selectedShaInTimeline,
  onShaChange,
  focusedNodePath,
}) => {
  const currentShaDate = manifest.find(
    (m) => m.sha_text === selectedShaInTimeline
  )?.commit_date;
  const showBackButton =
    (parentStack && parentStack.length > 0) || focusedNodePath;
  return (
    <div className="relative h-screen p-2 bg-gray-200 flex flex-col">
      {/* --- Botón de Volver --- */}
      {showBackButton && (
        <button
          onClick={onGoBack}
          className="absolute top-20 left-6 z-50 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg flex items-center justify-center transition"
          title="Volver al nivel anterior"
        >
          <BackIcon />
        </button>
      )}

      {/* --- Botón Modo Día/Noche --- */}
      <button
        onClick={onToggleMode}
        className="absolute top-6 left-6 z-50 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg flex items-center justify-center transition"
        title={isNightMode ? "Cambiar a modo Día" : "Cambiar a modo Noche"}
        aria-label={isNightMode ? "Cambiar a modo Día" : "Cambiar a modo Noche"}
      >
        {isNightMode ? <SunIcon /> : <MoonIcon />}
      </button>
      {isNightMode && (
        <div className="absolute top-6 left-24 z-50">
          <CriticalityFilter
            currentFilter={criticalityFilter}
            onChange={onFilterChange}
          />
        </div>
      )}

      {/* --- Botón de Analytics --- */}
      <button
        onClick={onToggleAnalytics}
        className="absolute top-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition"
      >
        <AnalyticsIcon />
        {sidePanelOpen ? "Hide Analytics" : "Show Analytics"}
      </button>

      <div className="flex flex-row flex-1 min-h-0 bg-white rounded-t-xl shadow-lg overflow-hidden transition-all duration-500 ease-in-out">
        {/* --- Izquierda: Canvas (Ploteo) --- */}
        <div
          className={`flex flex-col flex-[1] min-w-0 h-full gap-0 transition-all duration-500 ease-in-out ${
            sidePanelOpen ? "flex-[1]" : "flex-[1] w-full"
          }`}
        >
          <section
            className={`canvas bg-black relative flex items-center justify-center w-full h-full transition-all duration-500 ease-in-out ${
              sidePanelOpen ? "rounded-tl-xl" : "rounded-xl"
            }`}
          >
            <CityPlotter
              data={plotData}
              isNightMode={isNightMode}
              criticalityFilter={criticalityFilter}
              onMeshClick={onMeshClick}
              onMeshHover={onMeshHover}
              onMeshOut={onMeshOut}
              onSceneMount={onSceneMount}
              focusedNodePath={focusedNodePath}
            />

            {/* Timeline Flotante (Solo visible cuando el panel está CERRADO) */}
            {!sidePanelOpen && (
              <div className="absolute bottom-0 left-0 right-0 h-40 z-10 pointer-events-none">
                <div className="relative h-full pointer-events-auto">
                  <TimelineBarChart
                    manifest={manifest}
                    timelineData={analyticsData.timelineData}
                    selectedSha={selectedShaInTimeline}
                    onShaSelect={onShaChange}
                    isExpanded={false}
                  />
                </div>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                <Loading message="Fetching repository..." />
              </div>
            )}
          </section>
        </div>

        {/* --- Derecha: SidePanel (Solo si está abierto) --- */}
        {sidePanelOpen && (
          <aside className="flex-[1] min-w-[50%] bg-gray-900 text-white p-4 overflow-y-auto border-gray-300 transition-opacity duration-300">
            <SidePanel
              globalStats={analyticsData.globalStats}
              rootInfo={rootInfo}
              isNightMode={isNightMode}
              criticalityFilter={criticalityFilter}
              currentShaDate={currentShaDate}
              timelineData={analyticsData.timelineData.map((d) => ({
                ...d,
                date: d.commit_date,
              }))}
              onClose={onToggleAnalytics}
            />
          </aside>
        )}
      </div>

      {/* --- 2. FILA INTERMEDIA: DATOS (HORIZONTAL) --- */}
      {sidePanelOpen && (
        <section className="h-64 overflow-y-auto bg-gray-100 w-full border-gray-300 transition-opacity duration-300">
          <Datos
            info={rootInfo}
            childrenNodes={rootChildren}
            criticalityFilter={criticalityFilter}
          />
        </section>
      )}

      {/* --- 3. FILA INFERIOR: TIMELINE EXPANDIDO --- */}
      {sidePanelOpen && (
        <div className="flex-none h-36 bg-gray-900 rounded-b-xl shadow-inner z-10">
          <TimelineBarChart
            manifest={manifest}
            timelineData={analyticsData.timelineData}
            selectedSha={selectedShaInTimeline}
            onShaSelect={onShaChange}
            isExpanded={true}
          />
        </div>
      )}
    </div>
  );
};

// Definir los tipos de las props para un buen control
CityView.propTypes = {
  loading: PropTypes.bool.isRequired,
  parentStack: PropTypes.array.isRequired,
  isNightMode: PropTypes.bool.isRequired,
  sidePanelOpen: PropTypes.bool.isRequired,
  rootInfo: PropTypes.object,
  rootChildren: PropTypes.array.isRequired,
  analyticsData: PropTypes.object.isRequired,
  plotData: PropTypes.object,
  criticalityFilter: PropTypes.string.isRequired,
  onFilterChange: PropTypes.func.isRequired,
  onGoBack: PropTypes.func.isRequired,
  onToggleMode: PropTypes.func.isRequired,
  onToggleAnalytics: PropTypes.func.isRequired,
  onSceneMount: PropTypes.func.isRequired,
  onMeshClick: PropTypes.func.isRequired,
  onMeshHover: PropTypes.func.isRequired,
  onMeshOut: PropTypes.func.isRequired,
  manifest: PropTypes.array.isRequired,
  selectedShaInTimeline: PropTypes.string,
  onShaChange: PropTypes.func.isRequired,
  focusedNodePath: PropTypes.string,
};

export default CityView;
