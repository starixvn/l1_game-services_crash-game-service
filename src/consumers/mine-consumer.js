import { PlaceBetConsumer } from "sc-game-base/src/core/event-consumers";
import { Actions } from "../constants";
import { generateTapResult } from "../helpers/crash-point-helper";
import noticeHelper from "../helpers/notice-helper";

export class MineConsumer extends PlaceBetConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {BaseEventPublisher} publisher
     * @param {logger} logService
     * @param {mongoose.Model} betLogsRepository
     * @param {RoundResultConsumer} roundResultConsumer
     */
    constructor(definition, gameData, placeBetPublisher, logService, betLogsRepository, roundResultConsumer, settleCashOutConsumer) {
        super(definition, gameData, placeBetPublisher);
        this.logService = logService;
        this.betLogsRepository = betLogsRepository;
        this.roundResultConsumer = roundResultConsumer;
        this.settleCashOutConsumer = settleCashOutConsumer;
    }

    async mine(player, payload) {
        try {
            const validationResult = await this.validateMine(player, payload);

            if (!validationResult.isValid) {
                this.publishMineFailed(player, validationResult.error);
                return;
            }

            const playerName = player.profile.name;
            const playerGameData = this.gameData.ingame[playerName];
            const activeBet = playerGameData.activeBet;

            await this.handleMine(player, activeBet, payload.clientSendTime);
        } catch (err) {
            this.logService.logError(err);
            this.publishMineFailed(player, noticeHelper.invalidMine);
        }
    }

    async validateMine(player, payload) {
        const playerName = player.profile.name;
        const playerGameData = this.gameData.ingame[playerName];

        if (!playerGameData?.betTracks[Actions.Bet]) {
            return {
                isValid: false,
                error: noticeHelper.noBetFound,
            };
        }

        if (playerGameData.betTracks[Actions.CashOut]) {
            return {
                isValid: false,
                error: noticeHelper.alreadyCashOut,
            };
        }

        return {
            isValid: true,
        };
    }

    async handleMine(player, activeBet, clientSendTime) {
        const playerName = player.profile.name;
        const ingameData = this.gameData.ingame[playerName];
        const provablyFair = this.gameData.provablyFair[playerName];
        const multiplier = ingameData.activeBet.currentMultiplier;
        const increment = this.calculateIncrement(multiplier);
        const updatedMultiplier = +(
            multiplier == 1000 || provablyFair.finalResult < multiplier + increment ? 0 : multiplier + increment
        ).toFixed(2);
        ingameData.activeBet.currentMultiplier = updatedMultiplier;
        ingameData.activeBet.tapCount++;
        const result = provablyFair.finalResult;

        await this.insertMineBetLog(player, activeBet, {
            clientSendTime,
            increment,
            result,
            updatedMultiplier,
        });

        this.updatePlayerGameState(playerName, updatedMultiplier);
        this.publisher.publishMineResult(player.UID, {
            multiplier: updatedMultiplier,
            reachMaxWin: updatedMultiplier * activeBet.amount >= activeBet.maxWin,
        });

        if (updatedMultiplier == 0) {
            await this.settleCashOutConsumer.proceedCashOut(player, true);
        }
    }

    calculateIncrement(currentMultiplier) {
        const { multiplierConfigs } = this.gameData.gameConfigs.crashConfig;
        const { increment } = multiplierConfigs.stages.find(
            (stage) => currentMultiplier >= stage.minMultiplier && currentMultiplier < stage.maxMultiplier
        );

        return increment;
    }

    async insertMineBetLog(player, activeBet, { clientSendTime, increment, result, updatedMultiplier }) {
        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            action: Actions.Mine,
            amount: activeBet.amount,
            winAmount: activeBet.amount * updatedMultiplier,
            clientSendTime: clientSendTime,
            receivedTime: new Date(),
            freeBet: false,
            increment,
            result: generateTapResult(result),
            multiplier: updatedMultiplier,
            roundId: activeBet.roundId,
        };

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.rate = player.session.multiplier * this.gameData.exchangeRates.code[player.session.currencyCode];
            newBetLog.currencyMultiplier = player.session.multiplier;
            newBetLog.currencyCode = player.session.currencyCode;
            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
        }

        await this.betLogsRepository.create(newBetLog);
    }

    updatePlayerGameState(playerName, updatedMultiplier) {
        if (this.gameData.ingame?.[playerName]) {
            this.gameData.ingame[playerName].currentMultiplier = updatedMultiplier;
        }
    }

    publishMineFailed(player, errorCode) {
        this.publisher.publishGameFailedBet(player.UID, {
            endBet: -1,
            notice: { errorCode },
        });
    }
}
