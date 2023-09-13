export default class MultiplierPublishCron {
    constructor(runningRoundInfoPublisher, logService) {
        this.logService = logService;
        this.runningRoundInfoPublisher = runningRoundInfoPublisher;
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
        console.log(new Date());
    }
}
