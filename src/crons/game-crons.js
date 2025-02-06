import { Core } from "sc-game-base";

export default class GameCron extends Core.Crons.BaseGameCron {
    constructor({
        definition,
        gameData,
        bot,
        settleGameRoundConsumer,
        gameStatusPublisher,
        runningRoundInfoPublisher,
        logService,
        gameConfigsRepository,
        roundsRepository,
        archiveStatusesRepository,
        notificationRepository,
        exchangeRatesRepository,
        currencyGroupGamesRepository,
        partnerConfigRepository,
        currencyGroupRepository,
        currencyRepository,
        roundResultConsumer,
        resultsRepository,
        promotionRepository,
        appConfigs,
        provablyFairConsumer,
        unsettledRoundConsumer,
        betsRepository,
    }) {
        super({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
            archiveStatusesRepository,
            notificationRepository,
            exchangeRatesRepository,
            currencyGroupGamesRepository,
            partnerConfigRepository,
            currencyGroupRepository,
            currencyRepository,
            roundResultConsumer,
            resultsRepository,
            promotionRepository,
            appConfigs,
            provablyFairConsumer,
            unsettledRoundConsumer,
        });
        this.betsRepository = betsRepository;
    }
    async start() {
        await super.start();
        await this.proceedUnsettledBets();
    }
    async initRoundId() {
        const lastRound = await this.betsRepository
            .findOne({}, "roundId", { sort: { roundId: -1 } })
            .lean()
            .exec();

        if (lastRound) {
            this.gameData.roundId = lastRound.roundId + 1;
        } else {
            this.gameData.roundId = await this.getLastArchiveRound();
        }
    }

    async getLastArchiveRound() {
        const { configName } = this.definition;
        const archiveStatus = await this.archiveStatusesRepository.findOne({ name: configName }, "lastArcId").lean().exec();

        return archiveStatus ? archiveStatus.lastArcId["_bets"] + 1 : 1;
    }

    async proceed() {
        const { durations } = this.definition;

        if (this.gameData.remainingTime === durations.wholeRound) {
            await this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
            await this.processRunningRounds();
        }

        if (this.isStartingTime(this.gameData.remainingTime, durations)) {
            this.bot && (await this.bot.reset());
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;
        } else if (this.gameData.remainingTime < durations.placingBets) {
            this.bot && (await this.bot.run());
        }
    }

    async processRunningRounds() {}

    async proceedUnsettledBets() {
        const unsettledBets = await this.betsRepository.find({ paid: false }).lean().exec();

        await Promise.all(
            Object.values(unsettledBets).map((bet) =>
                this.settleGameRoundConsumer.settleRound({ roundId: bet.roundId, playerName: bet.name, time: Date.now() })
            )
        );
    }
}
