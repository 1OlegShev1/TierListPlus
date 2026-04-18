import "dotenv/config";
import { runSteamImport } from "./content/connectors/steam";

runSteamImport(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
