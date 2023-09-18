import { logger } from "sc-common";
import LiveGamePublisher from "../event-publishers/live-game-publisher";

export default class LivGameCrons {
    /**
     * @param {LiveGamePublisher} dependencies.liveGamePublisher
     * @param {logger} dependencies.logService
     */
    constructor({ liveGamePublisher, logService }) {
        this.liveGamePublisher = liveGamePublisher;
        this.logService = logService;
    }

    start() {
        const callback = () => {
            this.timeoutId = setTimeout(callback, 100);
            this.proceed();
        };
        setTimeout(callback(), 100);
    }

    stop() {
        clearTimeout(this.timeoutId);
    }

    proceed() {
        this.liveGamePublisher.publish();
    }
}
