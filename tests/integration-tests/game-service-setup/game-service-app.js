import { Core, Table } from "sc-game-base";
import { initAPIStub, stubUserService } from "sc-game-service-integration-utils";
import appConfigs from "../../../src/app-configs.IGT";
import gameSettings from "../../../src/game-settings";
import { generateRawResultForHash, generateResult, getSettlementResult } from "../../../src/helpers/result-helper";
import IGTContainerRegistry from "./igt-container-registry";

export const run = async () => {
    initAPIStub(appConfigs.apiSettings.apiUrl);
    stubUserService(appConfigs);

    const definition = new Table.TableGameDefinition(gameSettings, generateResult, getSettlementResult, generateRawResultForHash);
    const gameData = new Table.TableGameData(gameSettings.durations.wholeRound);
    const container = new IGTContainerRegistry().register(appConfigs, definition, gameData);
    const app = new Core.BaseGameApp("Spaceflight", appConfigs);

    await app.run();
    await app.startGame(container);
};

run();
