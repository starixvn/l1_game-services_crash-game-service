import { Actions } from "../constants";
import LiveGamePublisher from "../event-publishers/live-game-publisher";
import { calculateCrashTimeInMillisecond, calculateMultiplier } from "../helpers/crash-point-helper";
import { addMillisecond } from "../helpers/date-helper";

export default class LiveGameCron {
    /**
     * @param {LiveGamePublisher} dependencies.liveGamePublisher
     * @param {logger} dependencies.logService
     */
    constructor({ liveGamePublisher, logService, gameData, liveGameLogsRepository, processBetQueue }) {
        this.liveGamePublisher = liveGamePublisher;
        this.logService = logService;
        this.gameData = gameData;
        this.liveGameLogsRepository = liveGameLogsRepository;
        this.processBetQueue = processBetQueue;
    }

    start() {
        this.stop();

        const callback = () => {
            this.proceed();
            this.timeoutId = setTimeout(callback, 100);
        };

        this.proceed();
        setTimeout(() => callback(), 100);
    }

    stop() {
        clearTimeout(this.timeoutId);
    }

    proceed() {
        try {
            const currentTime = new Date();
            const liveTime = currentTime - this.gameData.startTime;
            const multiplier = calculateMultiplier(liveTime);

            this.liveGamePublisher.publish(multiplier, liveTime);
            this.proceedAutoCashOut(multiplier);
            this.liveGameLogsRepository.create({ multiplier, time: currentTime, roundId: this.gameData.roundId });
        } catch (err) {
            this.stop();
            this.logService.logError(err);
        }
    }

    async proceedAutoCashOut(multiplier) {
        const inGame = this.gameData.ingame;

        for (const playerName of Object.keys(inGame)) {
            const playerInGame = inGame?.[playerName];
            const betTracks = playerInGame?.betTracks;
            const bet = betTracks?.[Actions.Bet];
            if (bet?.autoCashOut && multiplier >= bet.autoCashOut && !betTracks[Actions.CashOut]) {
                const receivedTime = addMillisecond(this.gameData.startTime, calculateCrashTimeInMillisecond(bet.autoCashOut));

                const payload = {
                    roundId: this.gameData.roundId,
                    receivedTime,
                    action: Actions.CashOut,
                };

                betTracks[Actions.CashOut] = {
                    time: new Date(),
                };

                await this.processBetQueue.proceedCashOut(playerInGame.playerData, payload);
            }
        }
    }
}
