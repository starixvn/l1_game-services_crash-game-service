import MultiplierPublishCron from "./crons/multiplier-pulish-cron";

/* const run = async () => {
    const definition = new Core.GameDefinition(gameSettings, generateResult, getSettlementResult, generateRawResultForHash);
    const gameData = new Core.GameData(gameSettings.durations.wholeRound);
    const container = new ContainerRegistry().register(appConfigs, definition, gameData);
    const app = new Core.BaseGameApp("CrashGame", appConfigs);

    await app.run();
    await app.startGame(container);
};
 */
//run();

new MultiplierPublishCron().start();
