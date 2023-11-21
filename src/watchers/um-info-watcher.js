export default class UmInfoWatcher {
    constructor(gameData, umInfoRepository, logService) {
        this.umInfoRepository = umInfoRepository;
        this.gameData = gameData;
        this.logService = logService;
    }

    initChangeStream(pipeline = [], options = {}) {
        this.changeStream = this.umInfoRepository.watch(pipeline, options);
        this.registerEvents();
    }

    registerEvents() {
        this.changeStream.on("change", (event) => this.handleChangeStreamChange(event));
        this.changeStream.on("close", () => this.handleChangeStreamClosed());
        this.changeStream.on("error", (error) => this.handleChangeStreamError(error));
    }

    handleChangeStreamChange(data) {
        const { operationType } = data;
        if (operationType === "insert") {
            const { fullDocument } = data;
            const { partnerId } = fullDocument;

            const allPlayers = Object.values(this.gameData.ingame);
            const refundPlayers = partnerId ? allPlayers.filter((x) => x.operatorId === partnerId) : allPlayers;

            for (const player of refundPlayers) {
                player.isUm = true;
            }
        }
    }

    handleChangeStreamError(error) {
        this.logService.logError(error);
    }

    handleChangeStreamClosed() {
        const { resumeToken } = this.changeStream;

        setTimeout(() => {
            this.initChangeStream([], { startAfter: resumeToken });
        }, 1000);
        this.emit(WatcherEvent.CLOSE, "Change stream is CLOSED");
    }
}
