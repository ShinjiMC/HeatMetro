// jsonExport.service.js
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

// --- Constantes de Configuración ---
const DB_FILE = path.join(__dirname, "./", "repositories.db"); // Ajusta la ruta según tu estructura real
const OUTPUT_DIR = path.join(__dirname, "./", "data");
const SHAS_DIR = path.join(OUTPUT_DIR, "shas");
const LAYOUTS_DIR = path.join(OUTPUT_DIR, "layouts");
const FILES_DIR = path.join(OUTPUT_DIR, "files"); // Timelines de archivos
const FOLDERS_DIR = path.join(OUTPUT_DIR, "folders"); // Timelines de carpetas

function getSafeFilename(filePath) {
  return Buffer.from(filePath).toString("base64url");
}

function writeTimelineFile(filePath, timelineData) {
  const outputData = {
    file_path: filePath,
    timeline: timelineData,
  };

  const safeName = getSafeFilename(filePath);
  const jsonPath = path.join(FILES_DIR, `${safeName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(outputData));
}

function writeFolderTimelineFile(folderPath, timelineData) {
  const outputData = {
    folder_path: folderPath,
    timeline: timelineData,
  };

  const safeName = getSafeFilename(folderPath);
  const jsonPath = path.join(FOLDERS_DIR, `${safeName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(outputData));
}

function setupOutputDirectories() {
  fs.mkdirSync(SHAS_DIR, { recursive: true });
  fs.mkdirSync(LAYOUTS_DIR, { recursive: true });
  fs.mkdirSync(FILES_DIR, { recursive: true });
  fs.mkdirSync(FOLDERS_DIR, { recursive: true });
  // fs.mkdirSync(DETAILS_DIR, { recursive: true }); // Eliminado
}

// Objeto repositorio para centralizar consultas DB
const layoutRepo = {
  db: null,
  findShaIdStmt: null,
  getLayoutStmt: null,
  getMetricsStmt: null,
  getHierarchyStmt: null,
  getStructsStmt: null,
  init: (db) => {
    layoutRepo.db = db;
    layoutRepo.findShaIdStmt = db.prepare(
      "SELECT sha_id FROM tbl_sha WHERE sha_text = ? LIMIT 1"
    );
    layoutRepo.getLayoutStmt = db.prepare(
      "SELECT * FROM tbl_city_layout WHERE sha_id = ? AND path = ? LIMIT 1"
    );
    // getMetricsStmt traerá ahora sonar_url e issues_url gracias al SELECT * y el nuevo schema
    layoutRepo.getMetricsStmt = db.prepare(
      "SELECT * FROM tbl_folder_metrics WHERE sha_id = ? AND folder_path = ? LIMIT 1"
    );
    layoutRepo.getHierarchyStmt = db.prepare(
      "SELECT children FROM tbl_folder_hierarchy WHERE sha_id = ? AND folder_path = ? LIMIT 1"
    );
    layoutRepo.getStructsStmt = db.prepare(
      "SELECT * FROM tbl_city_layout WHERE sha_id = ? AND path LIKE ? AND type = 'STRUCT'"
    );
  },
  findShaIdByText: (shaText) => {
    return layoutRepo.findShaIdStmt.get(shaText)?.sha_id || null;
  },
};

// Construye el árbol anidado completo
function buildFullTreeFromMaps(
  rootPath,
  layoutMap,
  folderMetricsMap, // (tbl_folder_metrics)
  fileCohesionMap, // (tbl_cohesion)
  fileCoverageMap, // (AHORA contiene {percentage, sonar_url})
  fileLintMap, // (NUEVO: contiene {num_issues, issues_url})
  fileCriticalityMap, // (tbl_file_criticality)
  hierarchyMap,
  structMap
) {
  const rootLayout = layoutMap.get(rootPath);
  if (!rootLayout) {
    return null;
  }

  let nLines = 0,
    nMethods = 0,
    nAttrs = 0,
    coverage = 0;
  let severities = {};
  let debts = {};
  let sonarUrl = null;
  let issuesUrl = null;

  // --- Lógica para Carpetas ---
  if (rootLayout.type === "PACKAGE" || rootLayout.type === "ROOT") {
    const folderMetrics = folderMetricsMap.get(rootPath);
    if (folderMetrics) {
      nLines = folderMetrics.total_loc;
      nMethods = folderMetrics.total_method_count;
      nAttrs = folderMetrics.total_func_count;
      coverage = folderMetrics.avg_coverage;

      // Nuevos campos de URLs en carpetas
      sonarUrl = folderMetrics.sonar_url || null;
      issuesUrl = folderMetrics.issues_url || null;

      severities = {
        severity_complexity: folderMetrics.severity_complexity || "LOW",
        severity_coupling: folderMetrics.severity_coupling || "LOW",
        severity_issues: folderMetrics.severity_issues || "LOW",
        severity_churn: folderMetrics.severity_churn || "LOW",
        severity_authors: folderMetrics.severity_authors || "LOW",
        severity_halstead: folderMetrics.severity_halstead || "LOW",
        overall_severity: folderMetrics.overall_severity || "LOW",
      };
      debts = {
        debt_cov_overall: folderMetrics.debt_cov_overall,
        debt_cov_complexity: folderMetrics.debt_cov_complexity,
        debt_cov_coupling: folderMetrics.debt_cov_coupling,
        debt_cov_issues: folderMetrics.debt_cov_issues,
        debt_cov_churn: folderMetrics.debt_cov_churn,
        debt_cov_authors: folderMetrics.debt_cov_authors,
        debt_cov_halstead: folderMetrics.debt_cov_halstead,
      };
    }
  }
  // --- Lógica para Archivos ---
  else if (rootLayout.type === "FILE") {
    const cohesionMetrics = fileCohesionMap.get(rootPath);
    if (cohesionMetrics) {
      nLines = cohesionMetrics.loc;
      nMethods = cohesionMetrics.method_count;
      nAttrs = cohesionMetrics.func_count;
    }

    // Extraer datos de cobertura y URL Sonar
    const covData = fileCoverageMap.get(rootPath);
    if (covData) {
      coverage = covData.percentage || 0;
      sonarUrl = covData.sonar_url || null;
    }

    // Extraer URL de issues (Lint)
    const lintData = fileLintMap.get(rootPath);
    if (lintData) {
      issuesUrl = lintData.issues_url || null;
    }

    const criticalityMetrics = fileCriticalityMap.get(rootPath);
    if (criticalityMetrics) {
      severities = {
        severity_complexity: criticalityMetrics.severity_complexity || "LOW",
        severity_coupling: criticalityMetrics.severity_coupling || "LOW",
        severity_issues: criticalityMetrics.severity_issues || "LOW",
        severity_churn: criticalityMetrics.severity_churn || "LOW",
        severity_authors: criticalityMetrics.severity_authors || "LOW",
        severity_halstead: criticalityMetrics.severity_halstead || "LOW",
        overall_severity: criticalityMetrics.overall_severity || "LOW",
      };
      debts = {};
    }
  }

  const rootName =
    rootPath === "/"
      ? "Root"
      : rootPath.substring(rootPath.lastIndexOf("/") + 1);

  const rootNode = {
    name: rootName,
    path: rootPath,
    type: rootLayout.type,
    root_w: rootLayout.root_w,
    root_d: rootLayout.root_d,
    child_w: rootLayout.child_w,
    child_d: rootLayout.child_d,
    child_x: rootLayout.child_x,
    child_y: rootLayout.child_y,
    numberOfLines: nLines || 0,
    numberOfMethods: nMethods || 0,
    numberOfAttributes: nAttrs || 0,
    coverage: coverage || 0,
    url: rootPath,
    sonar_url: sonarUrl, // Nuevo campo
    issues_url: issuesUrl, // Nuevo campo
    ...severities,
    ...debts,
    children: [],
  };

  if (rootNode.type === "PACKAGE" || rootNode.type === "ROOT") {
    const childNames = hierarchyMap.get(rootPath) || [];

    for (const childName of childNames) {
      const childPath =
        rootPath === "/" ? childName : `${rootPath}/${childName}`;
      const childLayout = layoutMap.get(childPath);
      const childNode = buildFullTreeFromMaps(
        childPath,
        layoutMap,
        folderMetricsMap,
        fileCohesionMap,
        fileCoverageMap,
        fileLintMap, // Pasamos el nuevo mapa
        fileCriticalityMap,
        hierarchyMap,
        structMap
      );

      if (childNode) {
        rootNode.children.push(childNode);

        // Manejo de STRUCTS (clases internas/estructuras Go)
        if (childNode.type === "FILE" && childLayout) {
          const structLayouts = structMap.get(childNode.path) || [];
          for (const structLayout of structLayouts) {
            const structMetrics = fileCohesionMap.get(structLayout.path);
            const structName = structLayout.path.substring(
              structLayout.path.lastIndexOf(".(") + 2,
              structLayout.path.length - 1
            );

            // Los structs heredan la URL de sonar del archivo padre generalmente,
            // o se quedan sin ella si no son navegables individualmente.
            const structNode = {
              name: structName,
              path: structLayout.path,
              type: structLayout.type,
              child_w: structLayout.child_w,
              child_d: structLayout.child_d,
              child_x: structLayout.child_x || 0,
              child_y: structLayout.child_y || 0,
              numberOfLines: (structMetrics || {}).loc || 0,
              numberOfMethods: (structMetrics || {}).method_count || 0,
              numberOfAttributes: (structMetrics || {}).func_count || 0,
              url: structLayout.path,
              coverage: childNode.coverage,
              sonar_url: childNode.sonar_url, // Hereda URL del padre
              severity_complexity: childNode.severity_complexity,
              severity_coupling: childNode.severity_coupling,
              severity_issues: childNode.severity_issues,
              severity_churn: childNode.severity_churn,
              severity_authors: childNode.severity_authors,
              severity_halstead: childNode.severity_halstead,
              overall_severity: childNode.overall_severity,
              children: [],
            };
            childNode.children.push(structNode);
          }
        }
      }
    }
  }
  return rootNode;
}

function generateManifest(db) {
  console.log("Generando manifest.json...");
  // Se agregó commit_message al select
  const stmt = db.prepare(
    "SELECT sha_id, sha_text, commit_date, commit_message, author_name FROM tbl_sha ORDER BY commit_date DESC"
  );
  const allShas = stmt.all();
  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(allShas, null, 2));
  console.log(`Manifest generado con ${allShas.length} commits.`);
  return allShas;
}

function generateShaSnapshots(db, allShas) {
  console.log("Generando snapshots por SHA (Optimizada)...");

  // Consultas preparadas
  const layoutStmt = db.prepare(
    "SELECT * FROM tbl_city_layout WHERE sha_id = ?"
  );
  const folderMetricsStmt = db.prepare(
    "SELECT * FROM tbl_folder_metrics WHERE sha_id = ?"
  );
  const hierarchyStmt = db.prepare(
    "SELECT * FROM tbl_folder_hierarchy WHERE sha_id = ?"
  );
  const criticalityStmt = db.prepare(
    "SELECT * FROM tbl_file_criticality WHERE sha_id = ?"
  );
  const cohesionStmt = db.prepare(
    "SELECT * FROM tbl_cohesion WHERE sha_id = ?"
  );
  const coverageStmt = db.prepare(
    "SELECT * FROM tbl_coverage_summary WHERE sha_id = ?"
  );
  const lintSummaryStmt = db.prepare(
    "SELECT * FROM tbl_lint_summary WHERE sha_id = ?"
  );
  const halsteadStmt = db.prepare(
    "SELECT * FROM tbl_halstead WHERE sha_id = ?"
  );
  const couplingStmt = db.prepare(
    "SELECT * FROM tbl_coupling WHERE sha_id = ?"
  );
  const churnStmt = db.prepare("SELECT * FROM tbl_churn WHERE sha_id = ?");
  const complexityStmt = db.prepare(
    "SELECT * FROM tbl_complexity WHERE sha_id = ?"
  );
  let generatedCount = 0;
  for (const shaRow of allShas) {
    const shaJsonPath = path.join(SHAS_DIR, `${shaRow.sha_text}.json`);
    const layoutJsonPath = path.join(LAYOUTS_DIR, `${shaRow.sha_text}.json`);

    // Saltar si AMBOS archivos ya existen
    if (fs.existsSync(shaJsonPath) && fs.existsSync(layoutJsonPath)) continue;

    console.log(`Procesando SHA: ${shaRow.sha_text}...`);
    const sha_id = shaRow.sha_id;

    // --- Carga de Datos ---
    const allLayouts = layoutStmt.all(sha_id);
    const allFolderMetrics = folderMetricsStmt.all(sha_id);
    const allHierarchies = hierarchyStmt.all(sha_id);
    const allCriticality = criticalityStmt.all(sha_id);
    const allCohesion = cohesionStmt.all(sha_id);
    const allCoverage = coverageStmt.all(sha_id);
    const allLintSummary = lintSummaryStmt.all(sha_id);
    const allHalstead = halsteadStmt.all(sha_id);
    const allCoupling = couplingStmt.all(sha_id);
    const allChurn = churnStmt.all(sha_id);
    const allComplexity = complexityStmt.all(sha_id);

    // --- Creación de Mapas ---
    const layoutMap = new Map(allLayouts.map((row) => [row.path, row]));
    const folderMetricsMap = new Map(
      allFolderMetrics.map((row) => [row.folder_path, row])
    );
    const fileCohesionMap = new Map(
      allCohesion.map((row) => [row.file_path, row])
    );

    // Mapa modificado: Guarda objeto completo para obtener sonar_url
    const fileCoverageMap = new Map(
      allCoverage.map((row) => [
        row.file_path,
        { percentage: row.percentage, sonar_url: row.sonar_url },
      ])
    );

    // Nuevo Mapa: Lint summary para obtener issues_url
    const fileLintMap = new Map(
      allLintSummary.map((row) => [
        row.file_path,
        { num_issues: row.num_issues, issues_url: row.issues_url },
      ])
    );

    const fileCriticalityMap = new Map(
      allCriticality.map((row) => [row.file_path, row])
    );
    const hierarchyMap = new Map(
      allHierarchies.map((row) => [row.folder_path, JSON.parse(row.children)])
    );

    // Mapa especial para structs
    const structMap = new Map();
    for (const row of allLayouts) {
      if (row.type === "STRUCT") {
        try {
          const filePath = row.path.substring(0, row.path.indexOf(".("));
          if (!structMap.has(filePath)) structMap.set(filePath, []);
          structMap.get(filePath).push(row);
        } catch (e) {
          console.warn(`Struct con path inválido omitido: ${row.path}`);
        }
      }
    }

    // --- Construcción del Árbol (Layout) ---
    const nestedCityLayout = buildFullTreeFromMaps(
      "/",
      layoutMap,
      folderMetricsMap,
      fileCohesionMap,
      fileCoverageMap,
      fileLintMap, // Inyección del nuevo mapa
      fileCriticalityMap,
      hierarchyMap,
      structMap
    );

    if (!nestedCityLayout) {
      console.warn(
        `SHA ${shaRow.sha_text} no tiene datos de layout para '/'. Saltando.`
      );
      continue;
    }

    // 1. Objeto sha.json (Tablas planas)
    const shaData = {
      sha_info: shaRow,
      tbl_folder_metrics: allFolderMetrics,
      tbl_file_criticality: allCriticality,
      tbl_folder_hierarchy: allHierarchies,
      tbl_cohesion: allCohesion,
      tbl_coverage_summary: allCoverage,
      tbl_lint_summary: allLintSummary,
      tbl_halstead: allHalstead,
      tbl_coupling: allCoupling,
      tbl_churn: allChurn,
      tbl_complexity: allComplexity,
    };

    // 2. Escribe archivos
    fs.writeFileSync(shaJsonPath, JSON.stringify(shaData));
    fs.writeFileSync(layoutJsonPath, JSON.stringify(nestedCityLayout));

    // NOTA: Se ha eliminado la generación de DETAILS_DIR porque tbl_lint_detail
    // y tbl_coverage_detail ya no existen. Ahora usamos sonar_url.

    generatedCount++;
  }
  console.log(`Generados ${generatedCount} nuevos snapshots de SHA.`);
}

function generateFileTimelines(db) {
  console.log("Generando timelines por ARCHIVO...");
  const files = db.prepare("SELECT DISTINCT file_path FROM tbl_cohesion").all();

  // Consulta actualizada para coincidir con el nuevo schema
  // tbl_complexity ahora tiene una columna 'value' y 'file_path'
  const timelineStmt = db.prepare(`
    SELECT
      coh.file_path,
      s.sha_text,
      s.commit_date,
      IFNULL(coh.loc, 0) AS loc,
      IFNULL(cov.percentage, 0) AS coverage,
      (IFNULL(ch.added, 0) + IFNULL(ch.deleted, 0)) AS churn,
      SUM(IFNULL(cpl.value, 0)) AS complexity
    FROM tbl_cohesion AS coh
    JOIN tbl_sha AS s ON s.sha_id = coh.sha_id
    LEFT JOIN tbl_coverage_summary AS cov ON cov.sha_id = s.sha_id AND cov.file_path = coh.file_path
    LEFT JOIN tbl_churn AS ch ON ch.sha_id = s.sha_id AND ch.file_path = coh.file_path
    LEFT JOIN tbl_complexity AS cpl ON cpl.sha_id = s.sha_id AND cpl.file_path = coh.file_path
    GROUP BY
      coh.file_path, 
      s.sha_text, 
      s.commit_date, 
      IFNULL(coh.loc, 0), 
      IFNULL(cov.percentage, 0), 
      IFNULL(ch.added, 0), 
      IFNULL(ch.deleted, 0)
    ORDER BY
      coh.file_path ASC, s.commit_date ASC
  `);

  const allRows = timelineStmt.all();
  let currentFile = null;
  let currentTimeline = [];

  for (const row of allRows) {
    if (row.file_path !== currentFile && currentFile !== null) {
      writeTimelineFile(currentFile, currentTimeline);
      currentTimeline = [];
    }
    currentFile = row.file_path;
    const { file_path, ...timelineEntry } = row;
    currentTimeline.push(timelineEntry);
  }

  if (currentFile !== null) {
    writeTimelineFile(currentFile, currentTimeline);
  }
  console.log(`Timelines generados para ${files.length} archivos.`);
}

function generateFolderTimelines(db) {
  console.log("Generando timelines por CARPETA...");

  // tbl_folder_metrics en el nuevo schema tiene todos los campos necesarios
  const timelineStmt = db.prepare(`
    SELECT
      f.folder_path,
      s.sha_text,
      s.commit_date,
      f.avg_coverage AS coverage,
      f.total_complexity AS complexity,
      f.total_loc AS loc,
      f.total_churn AS churn,
      f.debt_cov_overall,
      f.debt_cov_complexity,
      f.debt_cov_coupling,
      f.debt_cov_issues,
      f.debt_cov_churn,
      f.debt_cov_authors,
      f.debt_cov_halstead,
      f.sonar_url,  -- Se añade si se desea usar en el timeline
      f.issues_url
    FROM tbl_folder_metrics AS f
    JOIN tbl_sha AS s ON s.sha_id = f.sha_id
    ORDER BY
      f.folder_path ASC, s.commit_date ASC
  `);

  const allRows = timelineStmt.all();
  let currentFolder = null;
  let currentTimeline = [];
  let folderCount = 0;

  for (const row of allRows) {
    if (row.folder_path !== currentFolder && currentFolder !== null) {
      writeFolderTimelineFile(currentFolder, currentTimeline);
      currentTimeline = [];
      folderCount++;
    }
    currentFolder = row.folder_path;
    const { folder_path, ...timelineEntry } = row;
    currentTimeline.push(timelineEntry);
  }

  if (currentFolder !== null) {
    writeFolderTimelineFile(currentFolder, currentTimeline);
    folderCount++;
  }
  console.log(`Timelines generados para ${folderCount} carpetas.`);
}

function generateStaticApi() {
  try {
    console.log("Iniciando generación de API estática...");
    setupOutputDirectories();

    const db = new Database(DB_FILE, { fileMustExist: true });
    console.log("Conectado a repositories.db");
    layoutRepo.init(db);

    const allShas = generateManifest(db);
    generateShaSnapshots(db, allShas);
    generateFileTimelines(db);
    generateFolderTimelines(db);

    db.close();
    console.log("Generación de API estática completada exitosamente.");
    return { success: true, message: "API estática generada." };
  } catch (error) {
    console.error("Error al generar la API estática:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateStaticApi,
};
