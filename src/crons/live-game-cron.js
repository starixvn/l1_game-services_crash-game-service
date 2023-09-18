export default class LivGameCrons {
    constructor(liveGamePublisher, logService) {
        this.logService = logService;
        this.liveGamePublisher = liveGamePublisher;
    }

    start() {
        const callback = () => {
            this.timeoutId = setTimeout(callback, 100);
            this.proceed();
        };
        setTimeout(callback, 100);
    }

    stop() {
        clearTimeout(this.timeoutId);
    }

    proceed() {
        this.liveGamePublisher.publish();
    }
}
