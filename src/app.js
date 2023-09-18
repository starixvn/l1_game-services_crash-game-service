import { Core } from "sc-game-base";
import appConfigs from "./app-configs";
import gameSettings from "./game-settings";
import { generateRawResultForHash, generateResult, getSettlementResult } from "./helpers/result-helper";
import ContainerRegistry from "./container-registry";

const run = async () => {
    const definition = new Core.GameDefinition(gameSettings, generateResult, getSettlementResult, generateRawResultForHash);
    const gameData = new Core.GameData(gameSettings.durations.wholeRound);
    const container = new ContainerRegistry().register(appConfigs, definition, gameData);
    const app = new Core.BaseGameApp("CrashGame", appConfigs);

    await app.run();
    await app.startGame(container);
};

run();
