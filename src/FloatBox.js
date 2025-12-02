// src/FloatBox.js
import React from "react";
import PropTypes from "prop-types";

const FILTER_LABELS = {
  complexity: "Complexity",
  coupling: "Coupling",
  issues: "Issues",
  churn: "Churn",
  authors: "Authors",
  halstead: "Halstead",
  overall: "Overall",
};

const FloatBox = ({ position, info, visible, criticalityFilter }) => {
  if (!visible || !info) return null;

  // --- LÓGICA DE DEUDA DINÁMICA ---
  let debtValue = null;
  let debtLabel = "Overall";

  console.log("FloatBox - criticalityFilter:", criticalityFilter);
  info && console.log("FloatBox - info:", info);

  // Solo mostramos deuda si es un PACKAGE/ROOT (los archivos no tienen deuda agregada, tienen su propio valor)
  if (info.type === "PACKAGE" || info.type === "ROOT") {
    if (
      criticalityFilter &&
      criticalityFilter !== "none" &&
      criticalityFilter !== "overall"
    ) {
      // Caso: Filtro específico (ej. Complexity)
      debtLabel = FILTER_LABELS[criticalityFilter] || criticalityFilter;
      const key = `debt_cov_${criticalityFilter}`;
      debtValue = info[key];
    } else {
      // Caso: Sin filtro o Overall -> Mostramos la deuda general
      debtValue = info.debt_cov_overall;
    }
  }
  // --------------------------------

  return (
    <div
      className="fixed z-[9999] pointer-events-auto"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div
        className="box is-unselectable bg-white text-black shadow-xl rounded-md border border-gray-300 p-4 max-w-xs"
        role="tooltip"
      >
        <h4 className="font-bold text-sm mb-2">
          {info.name || "Elemento"} [{info.type}]
        </h4>
        {info.type !== "ROOT" && (
          <div className="text-xs space-y-1">
            <p>
              <b>Lines:</b> {info.NOL ?? info.numberOfLines ?? "..."}
            </p>
            <p>
              <b>Methods:</b> {info.NOM ?? info.numberOfMethods ?? "..."}
            </p>
            <p>
              <b>Functions:</b> {info.NOA ?? info.numberOfAttributes ?? "..."}
            </p>

            {/* Cobertura Real (Siempre visible) */}
            <p>
              <b>Coverage:</b>{" "}
              {info.coverage === -1
                ? "-"
                : (info.coverage?.toFixed(1) ?? "...") + "%"}
            </p>

            {/* --- SECCIÓN DE DEUDA DINÁMICA --- */}
            {/* Solo se muestra si existe un valor de deuda (es decir, si hay archivos críticos) */}
            {debtValue !== null && debtValue !== undefined && (
              <div className="mt-2 pt-1 border-t border-gray-200">
                <p className="text-red-600 font-bold">
                  Cobertura Crítica ({debtLabel}): {debtValue.toFixed(1)}%
                </p>
                <p className="text-[10px] text-gray-500 italic">
                  (Promedio de archivos críticos)
                </p>
              </div>
            )}
            {/* -------------------------------- */}
          </div>
        )}
      </div>
    </div>
  );
};

FloatBox.displayName = "FloatBox";

FloatBox.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  info: PropTypes.shape({
    NOA: PropTypes.number,
    NOL: PropTypes.number,
    NOM: PropTypes.number,
    name: PropTypes.string,
    type: PropTypes.string,
    url: PropTypes.string,
    coverage: PropTypes.number,
    path: PropTypes.string,
    numberOfLines: PropTypes.number,
    numberOfMethods: PropTypes.number,
    numberOfAttributes: PropTypes.number,
    // Las nuevas props de deuda
    debt_cov_overall: PropTypes.number,
    debt_cov_complexity: PropTypes.number,
    debt_cov_coupling: PropTypes.number,
    debt_cov_issues: PropTypes.number,
    debt_cov_churn: PropTypes.number,
    debt_cov_authors: PropTypes.number,
    debt_cov_halstead: PropTypes.number,
  }),
  visible: PropTypes.bool,
  criticalityFilter: PropTypes.string, // Necesario para saber qué mostrar
};

export default FloatBox;
