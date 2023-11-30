import LiveGameCron from "../../src/crons/live-game-cron";
import CrashGameData from "../../src/game-data";

const start = () => {
    const liveCron = new LiveGameCron({});
    liveCron.gameData = new CrashGameData();
    liveCron.gameData.startTime = new Date();
    liveCron.start();
};

start();
