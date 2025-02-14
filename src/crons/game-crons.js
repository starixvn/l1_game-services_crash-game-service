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
        betLogsRepository,
        settleCashOutConsumer,
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
        this.betLogsRepository = betLogsRepository;
        this.settleCashOutConsumer = settleCashOutConsumer;
    }
    async start() {
        await this.initRoundId();
        await this.queryLastResult();
        await this.getSettingForNewRound();
        await this.updateExchangeRates();
        await this.proceedUnsettledBets();
        this.startCron();
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
        const unsettledBets = await this.roundsRepository.find({ paid: false }).lean().exec();

        await Promise.all(
            Object.values(unsettledBets).map(async (round) => {
                const betLogs = await this.betLogsRepository
                    .find({ roundId: round.id }, { _id: false }, { sort: { time: -1 } })
                    .lean()
                    .exec();

                const { siteId, currency, operatorId, playerId, rate, currencyMultiplier, currencyCode, multiplier } = betLogs[0];
                const tapCount = betLogs.length;

                const player = {
                    UID: round.uid,
                    profile: {
                        name: round.name,
                    },
                    session: {
                        siteId: siteId,
                        currencyName: currency,
                        currencyCode: currencyCode,
                        multiplier: currencyMultiplier,
                        operatorId: operatorId,
                        playerId: playerId,
                        rate: rate,
                    },
                };

                this.gameData.ingame[player.profile.name] = {
                    activeBet: {
                        roundId: round.id,
                        tapCount: tapCount,
                        currentMultiplier: multiplier,
                        amount: round.amount,
                    },
                };

                await this.settleCashOutConsumer.proceedCashOut(player, true);
            })
        );
    }
}
