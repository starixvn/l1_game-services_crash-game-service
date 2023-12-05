import { Core } from "sc-game-base";
import { Actions } from "../constants";
import { calculateCrashTimeInMillisecond } from "../helpers/crash-point-helper";

export default class GameCrons extends Core.Crons.BaseGameCron {
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
        liveGameCrons,
        betsRepository,
        betLogsRepository,
        umInfoWatcher,
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
        });

        this.liveGameCrons = liveGameCrons;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.umInfoWatcher = umInfoWatcher;
        this.settleCashOutConsumer = settleCashOutConsumer;
    }

    async start() {
        this.bot && (await this.bot.resetInRoomTrackings());
        await this.initRoundId();
        await this.queryLastResult();
        await this.updateExchangeRates();
        await this.proceedUnsettledBets();
        await this.initResultHash();
        await this.getSettingForNewRound();
        this.startCron();
        this.umInfoWatcher.initChangeStream();
    }

    async proceed() {
        const { durations } = this.definition;

        if (this.gameData.remainingTime === durations.wholeRound) {
            await this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
        }

        if (this.isStartingTime(this.gameData.remainingTime, durations)) {
            await this.resetForNewRound();
        }

        if (this.gameData.remainingTime === durations.placingBets && this.resultsRepository) {
            await this.roundResultConsumer.generateResultAndPublishHash(this.gameData.lastResultRecord);
            this.gameData.settlementResultFromAdmin = {};
        }

        if (this.gameData.remainingTime === durations.placingBets) {
            this.gameStatusPublisher.publishStartPlacingBetStatus();
        }

        if (this.gameData.remainingTime === durations.lockingBet - 1) {
            this.gameStatusPublisher.publishEndPlacingBetStatus();
        }

        if (this.gameData.remainingTime < durations.placingBets && this.gameData.remainingTime > 0) {
            this.bot && (await this.bot.run());
            this.runningRoundInfoPublisher.publish();
        }

        if (this.gameData.remainingTime === -1) {
            this.startDelaySettleRound();
            this.gameData.result > 1 && this.liveGameCrons.start();
        }

        if (this.gameData.remainingTime < -1) {
            this.bot && (await this.bot.cashOut());
        }
    }

    startDelaySettleRound() {
        const { durations } = this.definition;
        const gameResult = this.gameData.result;
        const settleTimeOut = calculateCrashTimeInMillisecond(gameResult);

        setTimeout(async () => {
            try {
                this.liveGameCrons.stop();
                await this.settleCashOutConsumer.proceedAutoCashOut(this.gameData.result);
                this.gameData.remainingTime = durations.wholeRound;
                await this.settleGameRoundConsumer.settleRound(this.gameData);
            } catch (err) {
                this.logService.logError(err);
            }
        }, settleTimeOut);

        this.gameData.startTime = new Date();
    }

    async proceedUnsettledBets() {
        const unsettledBets = await this.betsRepository.find({ paid: false, roundId: this.gameData.roundId }).lean().exec();
        if (unsettledBets.length > 0) {
            const betLogs = await this.betLogsRepository.find({ roundId: this.gameData.roundId }).lean().exec();

            await this.roundResultConsumer.generateResultAndPublishHash(this.gameData.lastResultRecord);

            for (const bet of unsettledBets) {
                const betLog = betLogs.filter((x) => x.playerId === bet.playerId);

                if (!betLog.some((x) => x.action === Actions.CashOut)) {
                    const halfCashOutLog = betLog.find((x) => x.action === Actions.HalfCashOut);
                    const amount = halfCashOutLog ? halfCashOutLog.amount : bet.amount;
                    await this.betLogsRepository.create({
                        uid: bet.uid,
                        name: bet.name,
                        time: new Date(),
                        action: Actions.Refund,
                        amount: amount,
                        winAmount: amount,
                        freeBet: bet.freeBet,
                        clientSentTime: new Date(),
                        receivedTime: new Date(),
                        roundId: bet.roundId,
                        siteId: bet.siteId,
                        currency: bet.currency,
                        rate: bet.rate,
                        operatorId: bet.operatorId,
                        playerId: bet.playerId,
                    });
                }
            }

            await this.settleGameRoundConsumer.settleRound();
        }
    }

    async resetForNewRound() {
        super.resetForNewRound();
        this.gameData.betList = {};
        this.bot && (await this.bot.reset());
        this.appConfigs.enabledBoostedOdds && (await this.updatePromotionOddsAndNotify());
    }
}
