// json.js
const { generateStaticApi } = require("./jsonExport.service");

async function main() {
  try {
    const exportResult = generateStaticApi();
    if (exportResult.success) {
      console.log("✅ ÉXITO: " + exportResult.message);
    } else {
      console.error("❌ ERROR generando API:", exportResult.error);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error fatal en la aplicación:", error);
    process.exit(1);
  }
}

main();
