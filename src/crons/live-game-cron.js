import LiveGamePublisher from "../event-publishers/live-game-publisher";
import { calculateMultiplier } from "../helpers/crash-point-helper";

export default class LiveGameCron {
    /**
     * @param {LiveGamePublisher} dependencies.liveGamePublisher
     * @param {logger} dependencies.logService
     */
    constructor({ liveGamePublisher, logService, gameData, liveGameLogsRepository, settleCashOutConsumer }) {
        this.liveGamePublisher = liveGamePublisher;
        this.logService = logService;
        this.gameData = gameData;
        this.liveGameLogsRepository = liveGameLogsRepository;
        this.settleCashOutConsumer = settleCashOutConsumer;
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
            this.settleCashOutConsumer.proceedAutoCashOut(multiplier);
            this.liveGameLogsRepository.create({ multiplier, time: currentTime, roundId: this.gameData.roundId });
        } catch (err) {
            this.stop();
            this.logService.logError(err);
        }
    }
}
