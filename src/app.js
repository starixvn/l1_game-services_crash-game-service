import { Core, Table } from "sc-game-base";
import appConfigs from "./app-configs";
import ContainerRegistry from "./container-registry";
import CrashGameData from "./game-data";
import gameSettings from "./game-settings";
import { generateRawResultForHash, generateResult, getSettlementResult } from "./helpers/result-helper";

const run = async () => {
    const definition = new Table.TableGameDefinition(gameSettings, generateResult, getSettlementResult, generateRawResultForHash);
    const gameData = new CrashGameData(gameSettings.durations.wholeRound);
    const container = new ContainerRegistry().register(appConfigs, definition, gameData);
    const app = new Core.BaseGameApp("Spaceflight", appConfigs);

    await app.run();
    await app.startGame(container);
};

run();
