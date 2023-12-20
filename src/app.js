import gameSettings from "./game-settings";
import appConfigs from "./app-configs";
import { startTrace } from "sc-instrument";

import GameManagementApiClientFactory from "sc-game-base/src/core/game-management-api";
import { Core, Table } from "sc-game-base";
import ContainerRegistry from "./container-registry";
import CrashGameData from "./game-data";
import { logger } from "sc-common";
import { generateRawResultForHash, generateResult, getSettlementResult } from "./helpers/result-helper";
import { getOrDefault } from "sc-game-base/src/core/game-management-api";

startTrace(appConfigs.otel?.enabled, appConfigs.otel?.endpoint, appConfigs.otel?.system, appConfigs.sentry.env, gameSettings.name);

const run = async () => {
    const appName = process.env.APP_NAME;
    const gameName = appName ? appName.replace("service", "").replaceAll("_", "") : "";

    if (appName) {
        const gameManagementApiClient = new GameManagementApiClientFactory(appConfigs).instance();

        appConfigs.database.url = appConfigs.database.url.concat(`&appName=${gameName.toLowerCase()}`);
        appConfigs.sentry.logIdentifier = gameName.toLowerCase();

        const app = new Core.BaseGameApp(gameName, appConfigs);
        await app.run();

        const gameConfigs = await getOrDefault(gameManagementApiClient.gameConfigs.getGameConfigs(gameName.toLowerCase()));

        if (gameConfigs) {
            gameSettings.id = gameConfigs.gameId;
            gameSettings.name = gameConfigs.displayName.replace(/ /g, "");

            const definition = new Table.TableGameDefinition(gameSettings, generateResult, getSettlementResult, generateRawResultForHash);
            const gameData = new CrashGameData(gameSettings.durations.wholeRound);
            const container = new ContainerRegistry().register(appConfigs, definition, gameData);

            await app.startGame(container);
        } else {
            logger.logCritical(`${gameName} config doesn't exist`);
        }
    } else {
        console.log("App Name is not defined, failed to bootstrap the service");
    }
};

process.on("exit", async (code) => {
    console.log(`About to exit with code: ${code}`);
    await initializer.shutdown();
});

run();
