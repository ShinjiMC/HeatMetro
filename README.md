# HeatMetro: Static Data Generator

<a href="https://opensource.org/licenses/MIT"> <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License MIT"> </a>

> **[Leer en Español](https://www.google.com/search?q=%23heatmetro-generador-de-datos-espa%C3%B1ol)**

![](.docs/logo.png)

---

## HeatMetro: Data Generator (English)

**HeatMetro: Generator** is a Node.js utility designed to transform a `repositories.db` SQLite database into a structured collection of **static JSON files**.

This tool is the core of HeatMetro's **Serverless Architecture**. By converting the database into static assets, the frontend (Viewer) can perform static analysis and visualization directly in the browser without needing a backend server or API calls. This enables zero-config deployment on static hosting services like **GitHub Pages**.

### Prerequisites

To use this tool, you first need a database file generated from a Git repository.

- **Get the Database:** Use the **[HeatMetro-Builder](https://github.com/ShinjiMC/HeatMetro-Builder)** tool to analyze a repository and generate the `repositories.db` file.

### Local Usage

If you want to generate the data manually (for local testing or development), follow these steps:

1.  **Setup the Project:**
    Clone this branch and install the dependencies.

    ```bash
    npm install
    ```

2.  **Place the Database:**
    Copy your generated `repositories.db` file into the root of this folder (next to `json.js`).

3.  **Run the Generator:**
    Execute the script to process the database.

    ```bash
    node json.js
    ```

4.  **The Output:**
    The script will create a **`data/`** folder containing all the necessary JSON files (timelines, snapshots, metrics).

### Next Steps: Visualization

Once you have the `data/` folder, you can visualize it using the frontend:

1.  Copy the generated `data/` folder.
2.  Go to the **[Viewer (Main Branch)](https://www.google.com/search?q=https://github.com/ShinjiMC/HeatMetro/tree/main)**.
3.  Paste the `data/` folder into the `public/` directory of the frontend application.
4.  Run the frontend to see your data visualized.

> **Note:** For automated deployment, you do not need to run this manually. The GitHub Actions pipeline defined in the Viewer's README handles this process automatically.

---

## HeatMetro: Generador de Datos (Español)

**HeatMetro: Generator** es una utilidad de Node.js diseñada para transformar una base de datos SQLite `repositories.db` en una colección estructurada de **archivos JSON estáticos**.

Esta herramienta es el núcleo de la **Arquitectura Serverless** de HeatMetro. Al convertir la base de datos en archivos estáticos, el frontend (Visor) puede realizar análisis estático y visualización directamente en el navegador sin necesidad de un servidor backend o llamadas a una API. Esto permite un despliegue de configuración cero en servicios de hosting estático como **GitHub Pages**.

### Requisitos Previos

Para usar esta herramienta, primero necesitas un archivo de base de datos generado a partir de un repositorio Git.

- **Obtener la Base de Datos:** Usa la herramienta **[HeatMetro-Builder](https://github.com/ShinjiMC/HeatMetro-Builder)** para analizar un repositorio y generar el archivo `repositories.db`.

### Uso Local

Si deseas generar los datos manualmente (para pruebas locales o desarrollo), sigue estos pasos:

1.  **Configurar el Proyecto:**
    Clona esta rama e instala las dependencias.

    ```bash
    npm install
    ```

2.  **Colocar la Base de Datos:**
    Copia tu archivo `repositories.db` generado en la raíz de esta carpeta (junto a `json.js`).

3.  **Ejecutar el Generador:**
    Ejecuta el script para procesar la base de datos.

    ```bash
    node json.js
    ```

4.  **El Resultado:**
    El script creará una carpeta **`data/`** que contiene todos los archivos JSON necesarios (líneas de tiempo, snapshots, métricas).

### Siguientes Pasos: Visualización

Una vez que tengas la carpeta `data/`, puedes visualizarla usando el frontend:

1.  Copia la carpeta `data/` generada.
2.  Ve al **[Visor (Rama Main)](https://www.google.com/search?q=https://github.com/ShinjiMC/HeatMetro/tree/main)**.
3.  Pega la carpeta `data/` dentro del directorio `public/` de la aplicación frontend.
4.  Ejecuta el frontend para ver tus datos visualizados.

> **Nota:** Para el despliegue automatizado, no necesitas ejecutar esto manualmente. El pipeline de GitHub Actions definido en el README del Visor maneja este proceso automáticamente.

---

## Author

- **Braulio Nayap Maldonado Casilla** - [GitHub Profile](https://github.com/ShinjiMC)

## License

This project is licensed under the MIT License. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
