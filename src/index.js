// src/index.js
import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import { HashRouter, Route, Switch } from "react-router-dom";

import VisualizationPage from "./VisualizationPage";

const Root = () => (
  <HashRouter basename={process.env.PUBLIC_URL}>
    <Switch>
      <Route path="/" component={VisualizationPage} />
    </Switch>
  </HashRouter>
);

ReactDOM.render(<Root />, document.getElementById("root"));
