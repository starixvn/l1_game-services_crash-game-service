import { Core } from "sc-game-base";
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
        unsettledRoundConsumer,
        provablyFairConsumer,
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
            unsettledRoundConsumer,
            provablyFairConsumer,
        });

        this.liveGameCrons = liveGameCrons;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.umInfoWatcher = umInfoWatcher;
        this.settleCashOutConsumer = settleCashOutConsumer;
    }

    async start() {
        this.bot && (await this.bot.resetInRoomTrackings());
        await super.start();
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
            await this.roundResultConsumer.generateServerSeedAndPublishHash(this.gameData.lastResultRecord);
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

        if (this.gameData.remainingTime === durations.mergeClientSeeds && this.resultsRepository) {
            await this.provablyFairConsumer.updateClientSeedFromBets();
            await this.roundResultConsumer.generateResult();
        }

        if (this.gameData.remainingTime === durations.liveTime) {
            this.startDelaySettleRound();
            this.gameData.result > 1 && this.liveGameCrons.start();
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

    async resetForNewRound() {
        super.resetForNewRound();
        this.gameData.betList = {};
        this.bot && (await this.bot.reset());
        this.appConfigs.enabledBoostedOdds && (await this.updatePromotionOddsAndNotify());
    }
}
