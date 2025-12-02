// src/VisualizationPage.js
import React, { Component } from "react";
import { getSafeFilename } from "./utils";
import FloatBox from "./FloatBox";
import axios from "axios";
import {
  Chart,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  TimeScale,
  Title,
  Tooltip,
  Legend as ChartLegend,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";
import Legend from "./Legend";
import swal from "sweetalert2";
import PropTypes from "prop-types";
import CityView from "./CityView";

Chart.register(
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  TimeScale,
  Title,
  Tooltip,
  ChartLegend,
  annotationPlugin
);

function findNodeInTree(node, pathKey) {
  if (!node || node.path === pathKey) {
    return node;
  }
  if (!node.children) {
    return null;
  }
  for (const child of node.children) {
    const found = findNodeInTree(child, pathKey);
    if (found) return found;
  }
  return null;
}

function adaptNodeForPlotter(node) {
  if (!node || typeof node !== "object" || node === null) {
    return null;
  }
  const adaptedNode = {
    ...node,
    x: node.child_x,
    y: node.child_y,
    w: node.child_w,
    d: node.child_d,
  };
  if (Array.isArray(node.children)) {
    const newChildren = [];
    for (const child of node.children) {
      if (child && typeof child === "object" && child !== null) {
        const adaptedChild = {
          ...child,
          x: child.child_x,
          y: child.child_y,
          w: child.child_w,
          d: child.child_d,
          children: [],
        };
        if (
          child.type === "FILE" &&
          Array.isArray(child.children) &&
          child.children.length > 0
        ) {
          for (const struct of child.children) {
            if (struct && typeof struct === "object" && struct !== null) {
              adaptedChild.children.push({
                ...struct,
                x: struct.child_x,
                y: struct.child_y,
                w: struct.child_w,
                d: struct.child_d,
                children: [],
              });
            }
          }
        }
        newChildren.push(adaptedChild);
      }
    }
    adaptedNode.children = newChildren;
  } else {
    adaptedNode.children = [];
  }
  return adaptedNode;
}

class VisualizationPage extends Component {
  canvas = null;
  lastData = null;

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      isNightMode: false,
      sidePanelOpen: false,
      commit: null,
      parentStack: [],
      currentPath: "/",
      manifest: [],
      selectedShaInTimeline: null,

      fullLayoutTree: null,
      allMetrics: [],
      // CORRECCIÓN: Estado para guardar las tablas planas de archivos
      fileMetricsTables: {
        tbl_churn: [],
        tbl_halstead: [],
        tbl_coupling: [],
        tbl_complexity: [],
        tbl_lint_summary: [],
      },
      plotData: null,
      focusedNodePath: null,

      rootInfo: null,
      rootChildren: [],
      analyticsData: {
        coverageGlobal: 0,
        coverageRoot: 0,
        coverageIncrease: 0,
        timelineData: [],
        globalStats: null,
      },
      criticalityFilter: "none",
      infoVisible: false,
      infoData: null,
      infoPosition: { x: 0, y: 0 },
    };
    this.fullDataCache = new Map();
    this.toggleMode = this.toggleMode.bind(this);
    this.openSidePanel = this.openSidePanel.bind(this);
    this.closeSidePanel = this.closeSidePanel.bind(this);
    this.saveAsPng = this.saveAsPng.bind(this);
    this.showTooltip = this.showTooltip.bind(this);
    this.hideTooltip = this.hideTooltip.bind(this);
    this.handleMeshClick = this.handleMeshClick.bind(this);
    this.onSceneMount = this.onSceneMount.bind(this);
    this.goBackLevel = this.goBackLevel.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.handleShaChange = this.handleShaChange.bind(this);
  }
  getParamsFromURL = () => {
    const hash = this.props.location.hash.replace(/^#\/?/, "");
    const commitSha = hash.split("/")[0] || null;
    return { commit: commitSha };
  };
  componentDidMount() {
    axios
      .get("data/manifest.json")
      .then((res) => {
        const manifest = res.data;
        if (!manifest || manifest.length === 0) {
          swal("Error", "No se encontró el manifest.json.", "error");
          return;
        }

        const params = this.getParamsFromURL();
        const commitToLoad = params.commit || manifest[0].sha_text;
        this.setState({
          manifest: manifest,
          commit: commitToLoad,
          selectedShaInTimeline: commitToLoad,
        });
        this.process(commitToLoad);
      })
      .catch((err) => {
        console.error("Error cargando manifest.json", err);
        swal(
          "Error de carga",
          "No se pudo cargar el archivo manifest.json.",
          "error"
        );
      });
  }

  handleShaChange = (newSha) => {
    if (newSha && newSha !== this.state.commit) {
      console.log(
        `Cambiando a SHA: ${newSha} en la ruta actual: ${this.state.currentPath}`
      );
      this.setState({
        commit: newSha,
        selectedShaInTimeline: newSha,
        loading: true,
        focusedNodePath: null,
      });
      this.loadSnapshotData(newSha, this.state.currentPath);
      const hash = `#/${newSha}`;
      this.props.history.push(hash);
    }
  };

  loadAnalyticsData = async (pathKey, nodeType) => {
    try {
      const safePath = getSafeFilename(pathKey);
      const isFile = nodeType === "FILE";
      const timelineURL = isFile
        ? `data/files/${safePath}.json`
        : `data/folders/${safePath}.json`;
      console.log("Cargando timeline desde:", timelineURL);
      const timelineRes = await axios.get(timelineURL);
      const lineChartData = timelineRes.data.timeline.map((d) => ({
        ...d,
        date: d.commit_date,
      }));
      const fullTimelineData = timelineRes.data.timeline;

      let coverageIncrease = 0;
      let coverageRoot = 0;
      if (lineChartData.length > 0) {
        coverageRoot = lineChartData[lineChartData.length - 1].coverage || 0;
      }
      if (lineChartData.length >= 2) {
        const last = lineChartData[lineChartData.length - 1].coverage;
        const first = lineChartData[0].coverage;
        coverageIncrease = +(last - first).toFixed(1);
      }
      this.setState((prev) => ({
        analyticsData: {
          ...prev.analyticsData,
          timelineData: fullTimelineData,
          lineChartData: lineChartData,
          coverageRoot: coverageRoot,
          coverageIncrease: coverageIncrease,
        },
      }));
    } catch (err) {
      console.error("Error cargando datos del SidePanel:", err);
      this.setState((prev) => ({
        analyticsData: {
          ...prev.analyticsData,
          timelineData: [],
          lineChartData: [],
          coverageRoot: 0,
          coverageIncrease: 0,
        },
      }));
    }
  };
  onMouseMove(e) {
    this.mouse_x = e.pageX;
    this.mouse_y = e.pageY;
  }
  toggleMode() {
    this.setState((prev) => ({ isNightMode: !prev.isNightMode }));
  }
  openSidePanel = () => {
    this.setState({ sidePanelOpen: true });
  };
  closeSidePanel = () => {
    this.setState({ sidePanelOpen: false });
  };

  handleFilterChange = (newFilter) => {
    this.setState({ criticalityFilter: newFilter });
  };
  showTooltip = (info, position) => {
    this.setState({
      infoVisible: true,
      infoData: info,
      infoPosition: position,
    });
  };

  hideTooltip() {
    this.setState({ infoVisible: false });
  }

  handleMeshClick = (info) => {
    if (info.type === "FILE") {
      console.log("Enfocando archivo (Ghost Mode):", info.path);
      this.setState({ focusedNodePath: info.path });
      this.updateUIForFile(info.path);
    } else if (info.type === "PACKAGE") {
      if (info.path !== "/") {
        console.log("Navegando a (Drill Down):", info.path);
        this.setState({ focusedNodePath: null });
        this.plotNodeByPath(info.path, "push");
      }
    }
  };

  // --- CORRECCIÓN CLAVE: Buscar datos en las tablas planas cargadas ---
  updateUIForFile = (pathKey) => {
    const node = findNodeInTree(this.state.fullLayoutTree, pathKey);
    if (!node) return;
    const uiDisplayName = node.path === "/" ? "Root" : node.path;

    // Obtener tablas del estado
    const {
      tbl_churn,
      tbl_halstead,
      tbl_complexity,
      tbl_coupling,
      tbl_lint_summary,
      tbl_coverage_summary,
    } = this.state.fileMetricsTables;

    // Buscar la fila correspondiente a este archivo
    const churnRow = tbl_churn.find((r) => r.file_path === pathKey) || {};
    const halsteadRow = tbl_halstead.find((r) => r.file_path === pathKey) || {};
    const complexityRow =
      tbl_complexity.find((r) => r.file_path === pathKey) || {};
    const couplingRow = tbl_coupling.find((r) => r.file_path === pathKey) || {};
    const lintRow = tbl_lint_summary.find((r) => r.file_path === pathKey) || {};
    const coverageRow =
      tbl_coverage_summary.find((r) => r.file_path === pathKey) || {};
    const newRootInfo = {
      ...node,
      name: uiDisplayName,
      type: node.type,
      url: node.url,
      // Métricas Básicas (vienen del tree/cohesion)
      NOL: node.numberOfLines,
      NOM: node.numberOfMethods,
      NOA: node.numberOfAttributes,
      coverage: node.coverage,

      // --- Inyección de datos desde tablas planas ---
      // Mapeo para Datos.js: 'total_' es el prefijo esperado
      total_complexity: complexityRow.value || 0,
      total_issues: lintRow.num_issues || 0,
      total_coupling_deps: couplingRow.num_dependency || 0,

      // Churn
      total_churn: churnRow.total || 0,
      total_frequency: churnRow.frequency || 0,
      total_authors: churnRow.authors || 0,

      // Halstead
      total_halstead_volume: halsteadRow.volume || 0,
      total_halstead_difficulty: halsteadRow.difficulty || 0,
      total_halstead_effort: halsteadRow.effort || 0,
      total_halstead_bugs: halsteadRow.bugs || 0,
      sonar_url: coverageRow.sonar_url || node.sonar_url,
      issues_url: lintRow.issues_url || node.issues_url,
      // ----------------------------------------------

      // Pasar severidades (que ya venían en el nodo)
      overall_severity: node.overall_severity,
      severity_complexity: node.severity_complexity,
      severity_coupling: node.severity_coupling,
      severity_issues: node.severity_issues,
      severity_churn: node.severity_churn,
      severity_authors: node.severity_authors,
      severity_halstead: node.severity_halstead,
    };

    const childrenNodes =
      node.children?.map((c) => ({
        name: c.name,
        type: c.type,
        path: c.path,
        coverage: c.coverage,
      })) || [];

    this.setState(
      {
        rootInfo: newRootInfo,
        rootChildren: childrenNodes,
      },
      () => {
        this.loadAnalyticsData(pathKey, "FILE");
      }
    );
  };

  onSceneMount = (e) => {
    this.canvas = e.canvas;
  };

  loadSnapshotData = (commit, pathKey) => {
    if (this.fullDataCache.has(commit)) {
      const snapshotData = this.fullDataCache.get(commit);
      this.plotProject(snapshotData, pathKey);
      return;
    }
    this.setState({ loading: true });
    const shaURL = `data/shas/${commit}.json`;
    const layoutURL = `data/layouts/${commit}.json`;
    console.log("Cargando snapshot y layout:", shaURL, layoutURL);
    Promise.all([axios.get(shaURL), axios.get(layoutURL)])
      .then(([shaRes, layoutRes]) => {
        const snapshotData = {
          ...shaRes.data,
          city_layout: layoutRes.data,
        };
        this.fullDataCache.set(commit, snapshotData);
        this.plotProject(snapshotData, pathKey);
      })
      .catch((e) => {
        this.setState({ loading: false });
        swal("Error durante el ploteo", e.message, "error");
        console.error(e);
      });
  };

  plotProject = (snapshotData, pathKey) => {
    const fullLayoutTree = snapshotData.city_layout;
    const allMetrics = snapshotData.tbl_folder_metrics;

    // --- CORRECCIÓN: Extraer tablas planas del snapshot ---
    const fileMetricsTables = {
      tbl_churn: snapshotData.tbl_churn || [],
      tbl_halstead: snapshotData.tbl_halstead || [],
      tbl_coupling: snapshotData.tbl_coupling || [],
      tbl_complexity: snapshotData.tbl_complexity || [],
      tbl_lint_summary: snapshotData.tbl_lint_summary || [],
      tbl_coverage_summary: snapshotData.tbl_coverage_summary || [],
    };
    // ------------------------------------------------------

    const nodeToPlot = findNodeInTree(fullLayoutTree, pathKey);
    if (!nodeToPlot) {
      this.setState({ loading: false });
      swal("Error", `Path no encontrado: ${pathKey}`, "error");
      return;
    }
    const metricsData = allMetrics.find((m) => m.folder_path === pathKey);
    const rootMetric = allMetrics.find((m) => m.folder_path === "/");
    const globalStats = rootMetric || {};
    const uiDisplayName = nodeToPlot.path === "/" ? "Root" : nodeToPlot.path;
    const rootInfo = {
      ...metricsData,
      name: uiDisplayName || nodeToPlot.name || "Root",
      type: nodeToPlot.type || "PACKAGE",
      url: nodeToPlot.url || "",
      NOL: metricsData?.total_loc || 0,
      NOM: metricsData?.total_method_count || 0,
      NOA: metricsData?.total_func_count || 0,
      coverage: metricsData?.avg_coverage || 0,
      debt_cov_overall: metricsData?.debt_cov_overall,
      debt_cov_complexity: metricsData?.debt_cov_complexity,
      debt_cov_coupling: metricsData?.debt_cov_coupling,
      debt_cov_issues: metricsData?.debt_cov_issues,
      debt_cov_churn: metricsData?.debt_cov_churn,
      debt_cov_authors: metricsData?.debt_cov_authors,
      debt_cov_halstead: metricsData?.debt_cov_halstead,
      sonar_url: metricsData?.sonar_url,
      issues_url: metricsData?.issues_url,
    };

    const childrenNodes =
      nodeToPlot.children?.map((c) => ({
        name: c.name,
        type: c.type,
        path: c.path,
        coverage: c.coverage,
      })) || [];
    let adaptedNodeToPlot = adaptNodeForPlotter(nodeToPlot);
    if (adaptedNodeToPlot) {
      adaptedNodeToPlot.w = adaptedNodeToPlot.root_w;
      adaptedNodeToPlot.d = adaptedNodeToPlot.root_d;
      adaptedNodeToPlot.x = 0;
      adaptedNodeToPlot.y = 0;
    }

    let nextFocus = null;
    if (this.state.focusedNodePath) {
      const focusedExists = findNodeInTree(
        fullLayoutTree,
        this.state.focusedNodePath
      );
      if (focusedExists) {
        nextFocus = this.state.focusedNodePath;
      }
    }
    this.setState(
      (prev) => ({
        loading: false,
        fullLayoutTree: fullLayoutTree,
        allMetrics: allMetrics,
        // Guardamos las tablas en el estado
        fileMetricsTables: fileMetricsTables,
        plotData: adaptedNodeToPlot,
        rootInfo,
        rootChildren: childrenNodes,
        focusedNodePath: nextFocus,
        analyticsData: {
          ...prev.analyticsData,
          globalStats: globalStats,
        },
      }),
      () => {
        this.loadAnalyticsData(pathKey, nodeToPlot.type);
        if (nextFocus) {
          this.updateUIForFile(nextFocus);
        }
      }
    );
  };

  plotNodeByPath = (pathKey, stackOp) => {
    const nodeToPlot = findNodeInTree(this.state.fullLayoutTree, pathKey);
    if (!nodeToPlot) {
      console.error("No se encontró el nodo para", pathKey);
      return;
    }
    let metricsData;
    let rootInfo;
    const uiDisplayName = nodeToPlot.path === "/" ? "Root" : nodeToPlot.path;
    if (nodeToPlot.type === "PACKAGE" || nodeToPlot.type === "ROOT") {
      metricsData = this.state.allMetrics.find(
        (m) => m.folder_path === pathKey
      );
      if (!metricsData) {
        metricsData = {
          total_loc: 0,
          total_method_count: 0,
          total_func_count: 0,
          avg_coverage: 0,
        };
      }
      rootInfo = {
        ...metricsData,
        name: uiDisplayName || nodeToPlot.name,
        type: nodeToPlot.type,
        url: nodeToPlot.url,
        NOL: metricsData.total_loc,
        NOM: metricsData.total_method_count,
        NOA: metricsData.total_func_count,
        coverage: metricsData.avg_coverage,
        debt_cov_overall: metricsData.debt_cov_overall,
        debt_cov_complexity: metricsData.debt_cov_complexity,
        debt_cov_coupling: metricsData.debt_cov_coupling,
        debt_cov_issues: metricsData.debt_cov_issues,
        debt_cov_churn: metricsData.debt_cov_churn,
        debt_cov_authors: metricsData.debt_cov_authors,
        debt_cov_halstead: metricsData.debt_cov_halstead,
      };
    } else {
      rootInfo = {
        ...nodeToPlot,
        name: uiDisplayName || nodeToPlot.name,
        type: nodeToPlot.type,
        url: nodeToPlot.url,
        NOL: nodeToPlot.numberOfLines,
        NOM: nodeToPlot.numberOfMethods,
        NOA: nodeToPlot.numberOfAttributes,
        coverage: nodeToPlot.coverage,
      };
    }
    const childrenNodes =
      nodeToPlot.children?.map((c) => ({
        name: c.name,
        type: c.type,
        path: c.path,
        coverage: c.coverage,
      })) || [];
    const adaptedNodeToPlot = adaptNodeForPlotter(nodeToPlot);
    if (adaptedNodeToPlot) {
      adaptedNodeToPlot.w = adaptedNodeToPlot.root_w;
      adaptedNodeToPlot.d = adaptedNodeToPlot.root_d;
      adaptedNodeToPlot.x = 0;
      adaptedNodeToPlot.y = 0;
    }

    this.setState(
      (prev) => {
        let newStack = [...prev.parentStack];
        if (stackOp === "push") {
          newStack.push(prev.currentPath);
        } else if (stackOp === "pop") {
          newStack.pop();
        }
        return {
          parentStack: newStack,
          currentPath: pathKey,
          plotData: adaptedNodeToPlot,
          rootInfo: rootInfo,
          rootChildren: childrenNodes,
          focusedNodePath: null,
        };
      },
      () => {
        this.loadAnalyticsData(pathKey, nodeToPlot.type);
      }
    );
  };

  goBackLevel = () => {
    if (this.state.focusedNodePath) {
      console.log("Quitando foco de archivo...");
      const parentPath = this.state.currentPath;
      this.setState({ focusedNodePath: null }, () => {
        this.plotNodeByPath(parentPath, "stay");
      });
      return;
    }

    const stack = [...this.state.parentStack];
    if (stack.length === 0) return;
    const parentPath = stack[stack.length - 1];
    console.log("Volviendo a (instantáneo):", parentPath);
    this.plotNodeByPath(parentPath, "pop");
  };

  process(commit) {
    if (!commit) {
      this.props.history.push("/");
      return;
    }
    this.setState({
      commit,
      selectedShaInTimeline: commit,
      loading: true,
      currentPath: "/",
      parentStack: [],
    });
    this.loadSnapshotData(commit, "/");
  }

  saveAsPng() {
    if (this.canvas) {
      const image = this.canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      const link = document.createElement("a");
      link.setAttribute(
        "download",
        `gotestcity-${this.state.repository}-${this.state.branch}.png`
      );
      link.setAttribute("href", image);
      link.click();
    } else {
      console.error("No se puede guardar la imagen: el canvas no está listo.");
    }
  }

  render() {
    return (
      <main>
        <FloatBox
          position={this.state.infoPosition}
          info={this.state.infoData}
          visible={this.state.infoVisible}
          criticalityFilter={this.state.criticalityFilter}
        />

        <CityView
          loading={this.state.loading}
          parentStack={this.state.parentStack}
          isNightMode={this.state.isNightMode}
          sidePanelOpen={this.state.sidePanelOpen}
          rootInfo={this.state.rootInfo}
          rootChildren={this.state.rootChildren}
          analyticsData={this.state.analyticsData}
          plotData={this.state.plotData}
          criticalityFilter={this.state.criticalityFilter}
          onFilterChange={this.handleFilterChange}
          onGoBack={this.goBackLevel}
          onToggleMode={this.toggleMode}
          onToggleAnalytics={
            this.state.sidePanelOpen ? this.closeSidePanel : this.openSidePanel
          }
          onSceneMount={this.onSceneMount}
          onMeshClick={this.handleMeshClick}
          onMeshHover={this.showTooltip}
          onMeshOut={this.hideTooltip}
          manifest={this.state.manifest}
          selectedShaInTimeline={this.state.selectedShaInTimeline}
          onShaChange={this.handleShaChange}
          focusedNodePath={this.state.focusedNodePath}
        />

        <Legend />
      </main>
    );
  }
}

VisualizationPage.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      repository: PropTypes.string,
    }),
  }),
  location: PropTypes.shape({
    hash: PropTypes.string,
  }),
  history: PropTypes.shape({
    push: PropTypes.func,
  }),
};

export default VisualizationPage;
