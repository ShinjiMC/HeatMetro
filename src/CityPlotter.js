// src/CityPlotter.js
import React, { Component } from "react";
import * as BABYLON from "babylonjs";
import BabylonScene from "./Scene";
import PropTypes from "prop-types";
import { getProportionalColor } from "./utils";

const colors = {
  PACKAGE: { start: { r: 255, g: 207, b: 64 }, end: { r: 200, g: 160, b: 50 } },
  FILE: { start: { r: 120, g: 190, b: 32 }, end: { r: 80, g: 150, b: 30 } },
  STRUCT: { start: { r: 100, g: 143, b: 255 }, end: { r: 60, g: 100, b: 200 } },
  ROOT: { start: { r: 160, g: 160, b: 160 }, end: { r: 100, g: 100, b: 100 } },
};

class CityPlotter extends Component {
  scene = null;
  engine = null;
  canvas = null;
  camera = null;
  light = null;
  resizeObserver = null;
  resizeScheduled = false;
  texturesCache = new Map();

  static propTypes = {
    data: PropTypes.object,
    isNightMode: PropTypes.bool,
    criticalityFilter: PropTypes.string,
    onMeshClick: PropTypes.func.isRequired,
    onMeshHover: PropTypes.func.isRequired,
    onMeshOut: PropTypes.func.isRequired,
    onSceneMount: PropTypes.func.isRequired,
    focusedNodePath: PropTypes.string,
  };

  componentWillUnmount() {
    this.resizeScheduled = false;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener("resize", this.onResize);
    }
  }

  onResize = () => {
    if (this.engine) {
      this.engine.resize();
    }
  };

  componentDidUpdate(prevProps) {
    const dataChanged = this.props.data && this.props.data !== prevProps.data;
    const modeChanged = this.props.isNightMode !== prevProps.isNightMode;
    const filterChanged =
      this.props.criticalityFilter !== prevProps.criticalityFilter;
    const focusChanged =
      this.props.focusedNodePath !== prevProps.focusedNodePath;

    if (dataChanged) {
      const shouldResetCamera = !this.props.focusedNodePath;
      this.plotData(shouldResetCamera);
    } else if (modeChanged || filterChanged) {
      this.plotData(false);
    } else if (focusChanged) {
      this.updateFocusEffect();
    }
  }

  plotData = (shouldResetCamera = true) => {
    if (!this.props.data) return;

    let prevCameraState = null;
    if (!shouldResetCamera && this.camera) {
      prevCameraState = {
        alpha: this.camera.alpha,
        beta: this.camera.beta,
        radius: this.camera.radius,
        target: this.camera.target.clone(),
      };
    }

    this.reset();
    const rootNode = this.props.data;
    const childrenToPlot = rootNode.children || [];
    let floorColor = colors.ROOT.start;
    const floorHeight = 0.1;

    const floorMesh = this.addBlock({
      x: rootNode.x,
      y: rootNode.y,
      width: rootNode.w,
      depth: rootNode.d,
      height: floorHeight,
      color: new BABYLON.Color3(
        floorColor.r / 255,
        floorColor.g / 255,
        floorColor.b / 255
      ),
      parent: null,
      info: rootNode,
      type: "ROOT",
    });

    this.plot(childrenToPlot, floorMesh, rootNode.coverage);

    if (prevCameraState) {
      this.camera.lowerRadiusLimit = null;
      this.camera.upperRadiusLimit = null;

      // Restaurar posición exacta
      this.camera.target = prevCameraState.target;
      this.camera.alpha = prevCameraState.alpha;
      this.camera.beta = prevCameraState.beta;
      this.camera.radius = prevCameraState.radius;

      const maxDimension = Math.max(rootNode.w, rootNode.d);
      this.camera.lowerRadiusLimit = 2;
      this.camera.upperRadiusLimit = maxDimension * 5;
      this.camera.minZ = 1;
      this.camera.maxZ = maxDimension * 10;

      if (this.props.focusedNodePath) {
        this.updateFocusEffect(false);
      }
    } else {
      if (this.props.focusedNodePath) {
        this.updateFocusEffect(true);
      } else if (shouldResetCamera) {
        this.updateCamera(rootNode.w, rootNode.d);
      }
    }
  };

  updateFocusEffect = (animate = true) => {
    if (!this.scene) return;
    const focusedPath = this.props.focusedNodePath;
    let targetMesh = null;
    this.scene.meshes.forEach((mesh) => {
      if (!mesh.info) return;

      let targetVisibility = 1;
      let isPickable = true;

      if (!focusedPath) {
        targetVisibility = 1;
        isPickable = true;
      } else {
        const isTarget = mesh.info.path === focusedPath;
        const isChild =
          mesh.info.path && mesh.info.path.startsWith(focusedPath + ".(");

        if (isTarget || isChild) {
          targetVisibility = 1;
          isPickable = true;
          if (isTarget) targetMesh = mesh;
        } else {
          targetVisibility = 0.1;
          isPickable = false;
        }
      }

      mesh.visibility = targetVisibility;
      mesh.isPickable = isPickable;
      const childrenMeshes = mesh.getChildMeshes();
      if (childrenMeshes && childrenMeshes.length > 0) {
        childrenMeshes.forEach((child) => {
          child.visibility = targetVisibility;
        });
      }
    });
    if (animate && focusedPath && targetMesh) {
      const bounds = targetMesh.getBoundingInfo();
      const center = bounds.boundingBox.centerWorld;

      const ease = new BABYLON.CubicEase();
      ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

      BABYLON.Animation.CreateAndStartAnimation(
        "camTarget",
        this.camera,
        "target",
        60,
        60,
        this.camera.target,
        center,
        0,
        ease
      );

      const targetRadius =
        Math.max(targetMesh.info.child_w || 10, targetMesh.info.child_d || 10) *
        4;
      BABYLON.Animation.CreateAndStartAnimation(
        "camRadius",
        this.camera,
        "radius",
        60,
        60,
        this.camera.radius,
        targetRadius,
        0,
        ease
      );
    } else if (animate && !focusedPath && this.props.data) {
      this.updateCamera(this.props.data.w, this.props.data.d);
    }
  };

  reset = () => {
    if (this.scene) {
      this.scene.dispose();
    }
    this.texturesCache.clear();
    this.scene = new BABYLON.Scene(this.engine);
    this.initScene();
  };

  initScene = () => {
    const isNight = this.props.isNightMode;
    this.scene.clearColor = isNight
      ? new BABYLON.Color3(0.05, 0.05, 0.1)
      : new BABYLON.Color3(0.7, 0.7, 0.7);

    this.camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 4,
      Math.PI / 4,
      1000,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    this.camera.attachControl(this.canvas, true);
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 5000;
    this.camera.wheelDeltaPercentage = 0.01;

    const light = new BABYLON.HemisphericLight(
      "global_light",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    light.intensity = 0.8;
  };

  onSceneMount = (e) => {
    this.scene = e.scene;
    this.canvas = e.canvas;
    this.engine = e.engine;
    this.props.onSceneMount(e);
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.engine && !this.resizeScheduled) {
          this.resizeScheduled = true;
          window.requestAnimationFrame(() => {
            if (this.engine) {
              this.engine.resize();
            }
            this.resizeScheduled = false;
          });
        }
      });
      this.resizeObserver.observe(this.canvas);
    } else {
      window.addEventListener("resize", this.onResize);
    }
    this.initScene();
    if (this.props.data) {
      this.plotData(true);
    }
    this.engine.runRenderLoop(() => {
      if (this.scene) {
        this.scene.render();
      }
    });
  };

  updateCamera = (width, depth) => {
    if (!this.camera) return;
    const maxDimension = Math.max(width, depth);
    const radius = maxDimension * 1.5;
    const ease = new BABYLON.CubicEase();
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

    BABYLON.Animation.CreateAndStartAnimation(
      "camTarget",
      this.camera,
      "target",
      60,
      60,
      this.camera.target,
      BABYLON.Vector3.Zero(),
      0,
      ease
    );
    BABYLON.Animation.CreateAndStartAnimation(
      "camRadius",
      this.camera,
      "radius",
      60,
      60,
      this.camera.radius,
      radius,
      0,
      ease
    );

    this.camera.alpha = -Math.PI / 4;
    this.camera.beta = Math.PI / 4;
    this.camera.radius = radius;
    this.camera.minZ = 1;
    this.camera.maxZ = radius * 10;
    this.camera.lowerRadiusLimit = maxDimension * 0.5;
    this.camera.upperRadiusLimit = maxDimension * 5;
  };

  // --- NUEVOS MÉTODOS AUXILIARES ---

  getHelipadTexture = () => {
    if (this.texturesCache.has("helipad"))
      return this.texturesCache.get("helipad");
    const texture = new BABYLON.DynamicTexture(
      "helipad",
      { width: 256, height: 256 },
      this.scene
    );
    const ctx = texture.getContext();
    ctx.fillStyle = "#333333";
    ctx.fillRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.arc(128, 128, 90, 0, 2 * Math.PI);
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
    ctx.font = "bold 120px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H", 128, 138);
    texture.update();
    this.texturesCache.set("helipad", texture);
    return texture;
  };

  getSymbolTexture = (type) => {
    const key = `symbol_${type}`;
    if (this.texturesCache.has(key)) return this.texturesCache.get(key);

    const texture = new BABYLON.DynamicTexture(
      key,
      { width: 128, height: 128 },
      this.scene
    );
    const ctx = texture.getContext();
    ctx.fillStyle = "#F0F0F0";
    ctx.fillRect(0, 0, 128, 128);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 90px Arial";

    if (type === "HOSPITAL") {
      ctx.fillStyle = "#FF0000"; // Cruz Roja
      ctx.fillText("+", 64, 70);
    } else {
      ctx.fillStyle = "#DAA520"; // Gold $
      ctx.fillText("$", 64, 70);
    }
    texture.update();
    this.texturesCache.set(key, texture);
    return texture;
  };

  createRoofSymbol = (parent, w, d, h, type) => {
    const size = Math.min(w, d) * 0.8;
    const plane = BABYLON.MeshBuilder.CreatePlane(
      "symbol",
      { size },
      this.scene
    );
    plane.parent = parent;
    plane.rotation.x = Math.PI / 2;
    plane.position.y = h / 2 + 0.05;

    const mat = new BABYLON.StandardMaterial("symMat", this.scene);
    if (type === "HELIPAD") {
      mat.diffuseTexture = this.getHelipadTexture();
    } else {
      mat.diffuseTexture = this.getSymbolTexture(type);
    }
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    if (this.props.isNightMode)
      mat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    plane.material = mat;
    plane.isPickable = false;
  };

  createTriangularRoof = (parent, w, d, h, baseColor) => {
    const roofFlattening = 0.25;
    const diameter = Math.max(w, d) * 1.1;
    const roof = BABYLON.MeshBuilder.CreateCylinder(
      "roof",
      {
        diameter: diameter,
        height: Math.min(w, d),
        tessellation: 3,
      },
      this.scene
    );
    roof.parent = parent;
    roof.rotation.z = Math.PI / 2;
    if (d > w) roof.rotation.y = Math.PI / 2;
    roof.scaling.x = roofFlattening;
    roof.position.y = h / 2 + diameter * 0.25 * roofFlattening;
    const mat = new BABYLON.StandardMaterial("roofMat", this.scene);
    if (this.props.isNightMode && baseColor) {
      mat.diffuseColor = baseColor;
    } else {
      mat.diffuseColor = new BABYLON.Color3(0.5, 0.2, 0.1);
    }
    roof.material = mat;
    roof.isPickable = false;
  };

  createRoofFrame = (parent, w, d, h) => {
    const thickness = Math.min(w, d) * 0.1;
    const frameHeight = 0.3;
    const makeBar = (bw, bd, bx, bz) => {
      const bar = BABYLON.MeshBuilder.CreateBox(
        "frame",
        { width: bw, depth: bd, height: frameHeight },
        this.scene
      );
      bar.parent = parent;
      bar.position.y = h / 2 + frameHeight / 2;
      bar.position.x = bx;
      bar.position.z = bz;
      const mat = new BABYLON.StandardMaterial("frameMat", this.scene);
      mat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
      bar.material = mat;
      bar.isPickable = false;
    };
    // Crear los 4 lados del marco
    makeBar(w, thickness, 0, d / 2 - thickness / 2);
    makeBar(w, thickness, 0, -d / 2 + thickness / 2);
    makeBar(thickness, d - 2 * thickness, w / 2 - thickness / 2, 0);
    makeBar(thickness, d - 2 * thickness, -w / 2 + thickness / 2, 0);
  };

  addBlock = (data) => {
    const bar = BABYLON.MeshBuilder.CreateBox(
      data.label,
      { width: data.width, depth: data.depth, height: data.height },
      this.scene
    );
    bar.receiveShadows = false;
    if (data.parent) {
      bar.parent = data.parent;
      var bounds = data.parent.getBoundingInfo();
      bar.position.y = bounds.maximum.y + data.height / 2.0;
    } else {
      bar.position.y = 0;
    }
    bar.position.x = data.x || 0;
    bar.position.z = data.y || 0;
    bar.info = data.info;

    const coverage = data.info.coverage !== undefined ? data.info.coverage : 0;
    const type = data.type || data.info.type;
    const hasChildren = data.info.children && data.info.children.length > 0;

    if (coverage === 100 && type !== "ROOT") {
      if (type === "PACKAGE") {
        this.createRoofSymbol(
          bar,
          data.width,
          data.depth,
          data.height,
          "HELIPAD"
        );
      } else if (type === "FILE") {
        if (hasChildren) {
          this.createRoofFrame(bar, data.width, data.depth, data.height);
        } else {
          const hash = (data.info.name || "").length;
          const sym = hash % 2 === 0 ? "HOSPITAL" : "BANK";
          this.createRoofSymbol(bar, data.width, data.depth, data.height, sym);
        }
      } else if (type === "STRUCT") {
        this.createTriangularRoof(
          bar,
          data.width,
          data.depth,
          data.height,
          data.color
        );
      }
    }

    bar.actionManager = new BABYLON.ActionManager(this.scene);
    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOverTrigger,
        (evt) => {
          if (this.props.focusedNodePath && bar.visibility < 0.5) return;
          const rect = this.canvas.getBoundingClientRect();
          const pos = {
            x: rect.left + evt.pointerX,
            y: rect.top + evt.pointerY,
          };
          this.props.onMeshHover(bar.info, pos);
        }
      )
    );
    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOutTrigger,
        this.props.onMeshOut
      )
    );
    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
        this.props.onMeshClick(bar.info);
      })
    );
    bar.material = new BABYLON.StandardMaterial(data.label + "mat", this.scene);
    bar.material.diffuseColor = data.color;
    bar.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    if (data.opacity < 1.0) bar.material.alpha = data.opacity;
    if (data.emissiveColor) bar.material.emissiveColor = data.emissiveColor;
    bar.freezeWorldMatrix();
    return bar;
  };

  coverageToColor = (coverage) => {
    const t = Math.max(0, Math.min(coverage, 100)) / 100;
    let r, g, b;
    if (t < 1 / 3) {
      r = 255;
      g = Math.round(128 * (t * 3));
      b = 0;
    } else if (t < 2 / 3) {
      r = 255;
      g = Math.round(128 + 127 * ((t - 1 / 3) * 3));
      b = 0;
    } else {
      r = 255;
      g = 255;
      b = Math.round(255 * ((t - 2 / 3) * 3));
    }
    return { r, g, b };
  };

  plot = (children, parent, inheritedCoverage = null) => {
    if (!children) return;
    children.forEach((data) => {
      let color;
      let isCritical = false;
      let opacity = 1.0;
      const filter = this.props.criticalityFilter;
      if (filter && filter !== "none") {
        let severityKey;
        if (filter === "overall") {
          severityKey = "overall_severity";
        } else {
          severityKey = `severity_${filter}`;
        }
        const severityValue = data[severityKey];
        if (severityValue === "CRITICAL" || severityValue === "HIGH") {
          isCritical = true;
        }
      }
      let emissiveColor = null;
      if (this.props.isNightMode) {
        if (data.type === "ROOT" || data.type === "STRUCT") {
          color = colors.ROOT.start;
        } else {
          const covVal = data.coverage ?? inheritedCoverage ?? 50;
          if (covVal === -1) {
            // Si es -1, lo ponemos gris neutro y semi-transparente
            color = { r: 100, g: 100, b: 100 };
            opacity = 0.3; // Muy transparente para indicar "no evaluado"
          } else {
            // Lógica normal de color por cobertura
            color = this.coverageToColor(covVal);
            if (isCritical) {
              emissiveColor = new BABYLON.Color3(
                color.r / 255,
                color.g / 255,
                color.b / 255
              );
            }
          }
        }
      } else {
        if (data.type === "ROOT") {
          color = colors.ROOT.start;
        } else {
          color = getProportionalColor(
            colors[data.type].start,
            colors[data.type].end,
            Math.min(100, data.numberOfLines / 2000.0)
          );
        }
      }
      var minHeight = 10;
      var height;
      if (data.type === "ROOT") {
        height = 0;
      } else if (data.type === "PACKAGE") {
        height = minHeight;
      } else if (data.type === "FILE") {
        height = Math.max((data.numberOfMethods || 0) / 10, minHeight / 2);
      } else if (data.type === "STRUCT") {
        height = Math.max((data.numberOfMethods || 0) / 1, minHeight / 4);
      } else {
        height = Math.max((data.numberOfMethods || 0) / 10, minHeight / 2);
      }

      var mesh = this.addBlock({
        x: data.x,
        y: data.y,
        width: data.w,
        depth: data.d,
        height: height,
        color: new BABYLON.Color3(color.r / 255, color.g / 255, color.b / 255),
        parent: parent,
        type: data.type,
        info: {
          name: data.name,
          path: data.path,
          url: data.url,
          type: data.type,
          children: data.children,
          NOM: data.numberOfMethods,
          NOL: data.numberOfLines,
          NOA: data.numberOfAttributes,
          test: data.test,
          coverage: data.coverage,
          overall_severity: data.overall_severity,
          severity_complexity: data.severity_complexity,
          severity_coupling: data.severity_coupling,
          severity_issues: data.severity_issues,
          severity_churn: data.severity_churn,
          severity_authors: data.severity_authors,
          severity_halstead: data.severity_halstead,
          debt_cov_overall: data.debt_cov_overall,
          debt_cov_complexity: data.debt_cov_complexity,
          debt_cov_coupling: data.debt_cov_coupling,
          debt_cov_issues: data.debt_cov_issues,
          debt_cov_churn: data.debt_cov_churn,
          debt_cov_authors: data.debt_cov_authors,
          debt_cov_halstead: data.debt_cov_halstead,
        },
      });

      if (opacity < 1.0) {
        mesh.visibility = opacity;
      }

      if (emissiveColor) {
        mesh.material.emissiveColor = emissiveColor;
      }

      if (parent) {
        mesh.parent = parent;
      }
      if (data.children && data.children.length > 0) {
        this.plot(data.children, mesh, data.coverage);
      }
    });
  };

  render() {
    return (
      <BabylonScene
        engineOptions={{
          preserveDrawingBuffer: true,
          stencil: true,
        }}
        onSceneMount={this.onSceneMount}
      />
    );
  }
}

export default CityPlotter;
