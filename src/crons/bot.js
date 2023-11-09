import Chance from "chance";
import { helpers } from "sc-common";
import { Constants, Table } from "sc-game-base";
import { Actions, Chips } from "../constants";
import { calculateMultiplier } from "../helpers/crash-point-helper";
import { roundFloat } from "../helpers/number-helper";

export default class Bot extends Table.Crons.TableGameBot {
    /**
     * @param {Table.TableGameDefinition} definition
     * @param {Table.TableGameData} gameData
     * @param {Core.BaseEventPublishers.BaseEventPublisher} publisher
     * @param {mongoose.Model} userInfosRepository
     * @param {mongoose.Model} tempBetsRepository
     */

    constructor(definition, gameData, publisher, userInfosRepository, tempBetsRepository, tempBetLogsRepository) {
        super(definition, gameData, publisher, userInfosRepository, tempBetsRepository);

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
                to: Number.MAX_VALUE,
                ratio: 0.05,
            },
        ];
    }

    getRemovalBotIds(totalRemoval) {
        const botsNotHaveBet = Object.values(this.botsInRoom).filter((bot) => bot.totalBet === 0);
        const botIds = Object.keys(botsNotHaveBet);

        return botIds?.length > totalRemoval ? this.chance.pickset(Object.keys(botsNotHaveBet), totalRemoval) : botIds;
    }

    async placeBet(bot) {
        const maxBet = this.gameData.gameConfigs.bot_maxbet;
        const minBet = this.getMinBet();
        const amount = this.convertAmountToChip(helpers.numberHelper.getRandomNumberStep5(minBet, maxBet, true));

        if (this.gameData.remainingTime > this.definition.durations.lockingBet) {
            const user = await this.userInfosRepository.findOneAndUpdate(
                { id: bot.id, red: { $gt: amount } },
                { $inc: { red: -amount } },
                { new: true, lean: true }
            );

            if (user) {
                await this.insertBet(bot, amount);

                this.totalTickets += 1;

                this.updateBotInRoomData(bot, amount, user.red);
                this.updateBalanceAndPublishBetPayload(bot.id, null, amount, user.red);
            }
        }
    }

    async cashOut() {
        if (this.gameData.remainingTime < 0) {
            const botsToCashOut = this.getBotsToCashOut();

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
                            },
                        });
                        bot.multiplier = multiplier;
                        return this.insertBetLog(bot, { amount, winAmount, action, multiplier });
                    }

                    return Promise.resolve();
                })
            );
        }
    }

    getBotsToCashOut() {
        const multiplier = calculateMultiplier(new Date() - this.gameData.startTime);
        const range = this.cashOutDistributions.find((x) => x.from <= multiplier && x.to >= multiplier);
        const botsHaveBet = Object.values(this.botsInRoom).filter((bot) => bot.totalBet > 0);

        const maxCashOutBot = Math.floor(botsHaveBet.length * range.ratio);
        const botsHaveCashOut = botsHaveBet.filter((bot) => bot.cashOut && bot.multiplier >= range.from && bot.multiplier <= range.to);

        if (botsHaveCashOut.length < maxCashOutBot) {
            const botsToCashOut = botsHaveBet.filter((bot) => !bot.cashOut);
            return this.chance.pickset(botsToCashOut, this.chance.integer({ min: 0, max: maxCashOutBot - botsHaveCashOut.length }));
        }

        return [];
    }

    updateBotInRoomData(bot, amount, balance) {
        bot.totalBet += amount;
        bot.red = balance;
        bot.remainTickets--;
    }

    resetBot(bot) {
        bot.totalBet = 0;
        bot.remainTickets = 1;
        bot.cashOut = false;
        bot.halfCashOut = false;
        bot.multiplier = 0;
    }

    convertAmountToChip(amount) {
        const chipList = Chips.filter((chip) => amount % chip === 0);

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
        };

        await this.tempBetsRepository.create(newBet);
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
}
