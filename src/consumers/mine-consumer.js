import { PlaceBetConsumer } from "sc-game-base";
import { Actions } from "../constants";
import { generateTapResult } from "../helpers/crash-point-helper";
import noticeHelper from "../helpers/notice-helper";

export class MineConsumer extends PlaceBetConsumer {
    /**
     * @param {Object} dependencies
     * @param {GameData} dependencies.gameData
     * @param {PlaceBetPublisher} dependencies.placeBetPublisher
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {RoundResultConsumer} dependencies.roundResultConsumer
     */
    constructor({ gameData, placeBetPublisher, logService, betLogsRepository, roundResultConsumer }) {
        super({ gameData, placeBetPublisher, logService });
        this.betLogsRepository = betLogsRepository;
        this.roundResultConsumer = roundResultConsumer;
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

        if (!playerGameData?.activeBet) {
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
        const { provablyFair } = this.gameData.provablyFair[playerName];
        const multiplier = ingameData.currentMultiplier;
        const increment = this.calculateIncrement(multiplier);
        const updatedMultiplier = provablyFair.finalResult > multiplier + increment ? 0 : multiplier + increment;
        const result = provablyFair.finalResult;

        await this.insertMineBetLog(player, activeBet, {
            clientSendTime,
            increment,
            result,
            updatedMultiplier,
        });

        this.updatePlayerGameState(playerName, updatedMultiplier);
        this.publishMineResult(player, activeBet.id, updatedMultiplier);

        if (updatedMultiplier == 0) {
            await this.settleCashOutConsumer.proceedCashOut(player, true);
        }
    }

    calculateIncrement(currentMultiplier) {
        const multiplierConfigs = this.gameData.gameConfigs;
        const { increment } = multiplierConfigs.stages.find(
            (stage) => currentMultiplier >= stage.minMultiplier && currentMultiplier <= stage.maxMultiplier
        );

        return increment;
    }

    async insertMineBetLog(player, activeBet, { clientSendTime, increment, result, updatedMultiplier }) {
        await this.betLogsRepository.create({
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
            roundId: this.gameData.roundId,
        });
    }

    updatePlayerGameState(playerName, updatedMultiplier) {
        if (this.gameData.ingame?.[playerName]) {
            this.gameData.ingame[playerName].currentMultiplier = updatedMultiplier;
        }
    }

    publishMineResult(player, betId, multiplier) {
        this.placeBetPublisher.publishMineResult(player.UID, {
            multiplier,
            betId,
        });
    }

    publishMineFailed(player, errorCode) {
        this.placeBetPublisher.publishGameFailedBet(player.UID, {
            endBet: -1,
            notice: { errorCode },
        });
    }
}
