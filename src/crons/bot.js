import Chance from "chance";
import { Constants, Table } from "sc-game-base";
import { Actions, Chips } from "../constants";
import CrashGameData from "../game-data";
import { calculateMultiplier } from "../helpers/crash-point-helper";
import { roundFloat } from "../helpers/number-helper";
export default class Bot extends Table.Crons.TableGameBot {
    /**
     * @param {Table.TableGameDefinition} definition
     * @param {CrashGameData} gameData
     * @param {Core.BaseEventPublishers.BaseEventPublisher} publisher
     * @param {mongoose.Model} userInfosRepository
     * @param {mongoose.Model} tempBetsRepository
     */

    constructor(definition, gameData, publisher, userInfosRepository, tempBetsRepository, tempBetLogsRepository, provablyFairConsumer) {
        super(definition, gameData, publisher, userInfosRepository, tempBetsRepository, provablyFairConsumer);

        this.tempBetLogsRepository = tempBetLogsRepository;
        this.chance = new Chance();
        this.cashOutBoundary = 3.5;
        this.cashOutDistributions = [
            {
                from: 1.01,
                to: 2,
                ratio: 0.2,
            },
            {
                from: 2.01,
                to: 4,
                ratio: 0.45,
            },
            {
                from: 4.01,
                to: 5.0,
                ratio: 0.15,
            },
            {
                from: 5.01,
                to: 7.0,
                ratio: 0.15,
            },
            {
                from: 7.01,
                to: 2000,
                ratio: 0.05,
            },
        ];

        this.maxBetStrategy = [
            { weight: 40, getMaxBet: (minBet, maxBet) => Math.min(minBet * 50, 0.3 * maxBet) },
            { weight: 30, getMaxBet: (minBet, maxBet) => Math.min(minBet * 10, 0.3 * maxBet) },
            { weight: 30, getMaxBet: (minBet, maxBet) => maxBet },
        ];
        this.betOddAmount = 30;
    }

    getBotMaxBet(minBet, maxBet) {
        const weights = this.maxBetStrategy.map((setting) => setting.weight);

        return this.chance.weighted(this.maxBetStrategy, weights).getMaxBet(minBet, maxBet);
    }

    getCashOutPoint() {
        const weights = this.cashOutDistributions.map((setting) => setting.ratio);
        const cashOutStrategy = this.chance.weighted(this.cashOutDistributions, weights);

        return roundFloat(this.chance.floating({ min: cashOutStrategy.from, max: cashOutStrategy.to }));
    }

    getRemovalBotIds(totalRemoval) {
        const botsNotHaveBet = Object.values(this.botsInRoom).filter((bot) => bot.totalBet === 0 && bot.remainTickets > 0);
        const botIds = botsNotHaveBet.map((x) => x.id);

        return botIds?.length > totalRemoval ? this.chance.pickset(botIds, totalRemoval) : botIds;
    }

    getBotsToBet() {
        const botsToBet = super.getBotsToBet();

        botsToBet.forEach((bot) => bot.remainTickets--);

        return botsToBet;
    }

    async placeBet(bot) {
        if (this.gameData.remainingTime > this.definition.durations.lockingBet) {
            const maxBet = this.gameData.gameConfigs.bot_maxbet;
            const minBet = this.getMinBet();
            const amount = this.getBetAmount(minBet, maxBet);
            bot.clientSeed = this.generateClientSeed();

            const currentBet = await this.tempBetsRepository.findOne({ uid: bot.id, roundId: this.gameData.roundId }).lean().exec();

            const user = await this.userInfosRepository.findOneAndUpdate(
                { id: bot.id, red: { $gt: amount } },
                { $inc: { red: -amount } },
                { new: true, lean: true }
            );

            if (user && !currentBet) {
                await this.insertBet(bot, amount);

                this.totalTickets += 1;

                this.updateBotInRoomData(bot, amount, user.red);
                this.updateBalanceAndPublishBetPayload(bot.id, null, amount, user.red);
                this.gameData.addPlayerToBetList(bot.id, { name: bot.name, amount, rate: this.botRate });
            }
        }
    }

    getBetAmount(minBet, maxBet) {
        const botMaxBet = this.getBotMaxBet(minBet, maxBet);
        const isBetOddAmount = this.chance.bool({ likelihood: 30 });

        const amount = this.chance.natural({ min: minBet, max: botMaxBet });

        return isBetOddAmount ? amount : this.convertToEvenAmount(amount);
    }

    async cashOut(multiplier) {
        if (this.gameData.remainingTime < 0) {
            const botsToCashOut = this.getBotsToCashOut(multiplier);

            const { startTime, result } = this.gameData;
            await Promise.all(
                botsToCashOut.map((bot) => {
                    if (bot.halfCashOut) {
                        bot.cashOut = true;
                    } else {
                        bot.halfCashOut = this.chance.bool();
                        bot.cashOut = !bot.halfCashOut;
                    }

                    const action = bot.cashOut ? Actions.CashOut : Actions.HalfCashOut;
                    const amount = bot.halfCashOut ? roundFloat(bot.totalBet / 2) : bot.totalBet;
                    const multiplier = calculateMultiplier(new Date() - startTime);

                    if (multiplier < result) {
                        const winAmount = roundFloat(amount * multiplier);

                        this.publisher.publishToAllUsersExceptSystem(Constants.Systems.Mobi, null, {
                            otherPlayer: {
                                name: bot.name,
                                playerId: bot.id,
                                [action]: { amount, win: winAmount, multiplier },
                                rate: this.botRate,
                            },
                        });
                        bot.multiplier = multiplier;
                        this.gameData.updatePlayerAction(bot.id, action, {
                            amount,
                            win: winAmount,
                            multiplier,
                            cashOutWin: winAmount,
                            reachMaxWin: false,
                        });
                        return this.insertBetLog(bot, { amount, winAmount, action, multiplier });
                    }

                    return Promise.resolve();
                })
            );
        }
    }

    getBotsToCashOut(multiplier) {
        const botsHaveBet = Object.values(this.botsInRoom).filter((bot) => !bot.cashOut && bot.totalBet > 0);

        return botsHaveBet.filter((bot) => bot.expectCashOut && bot.expectCashOut <= multiplier);
    }

    updateBotInRoomData(bot, amount, balance) {
        bot.totalBet += amount;
        bot.red = balance;
        bot.expectCashOut = this.getCashOutPoint();
    }

    resetBot(bot) {
        bot.totalBet = 0;
        bot.remainTickets = 1;
        bot.cashOut = false;
        bot.halfCashOut = false;
        bot.multiplier = 0;
        bot.expectCashOut = 0;
        bot.clientSeed = null;
    }

    convertToEvenAmount(amount) {
        const chipList = Chips.filter((chip) => amount / chip > 1);

        return chipList.length > 0 ? chipList[0] : this.getMinBet();
    }

    async insertBet(bot, amount) {
        const newBet = {
            uid: bot.id,
            name: bot.name,
            roundId: this.gameData.roundId,
            time: new Date(),
            currency: " ",
            operatorId: " ",
            amount,
            rate: this.botRate,
            clientSeed: bot.clientSeed,
        };

        await this.tempBetsRepository.create(newBet);

        return newBet.time;
    }

    async insertBetLog(bot, { amount, winAmount, action, multiplier }) {
        const newBet = {
            uid: bot.id,
            name: bot.name,
            roundId: this.gameData.roundId,
            time: new Date(),
            receivedTime: new Date(),
            currency: " ",
            operatorId: " ",
            amount,
            rate: this.botRate,
            action,
            winAmount,
            multiplier,
        };

        await this.tempBetLogsRepository.create(newBet);
    }

    generatePlaceBetPayload(playerId, choice, amount, balance) {
        return {
            playerChip: { playerId, name: this.gameData.players[playerId].name, amount, red: balance, rate: this.botRate },
        };
    }
}
