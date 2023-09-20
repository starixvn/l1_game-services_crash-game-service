import { logger } from "sc-common";
import LiveGamePublisher from "../event-publishers/live-game-publisher";

export default class LivGameCrons {
    /**
     * @param {LiveGamePublisher} dependencies.liveGamePublisher
     * @param {logger} dependencies.logService
     */
    constructor({ liveGamePublisher, logService, gameData }) {
        this.liveGamePublisher = liveGamePublisher;
        this.logService = logService;
        this.gameData = gameData;
    }

    start() {
        this.proceed();

        this.intervalId = setInterval(() => {
            this.proceed();
        }, 100);
    }

    stop() {
        clearInterval(this.intervalId);
    }

    proceed() {
        this.liveGamePublisher.publish();
    }
}
