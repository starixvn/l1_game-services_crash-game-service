import Chance from "chance";
import { Core } from "sc-game-base";
import { cardRanks } from "../cards";
import { choiceNames } from "../game-settings";

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
        collectConsumer,
        settleTurnConsumer,
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
        });

        this.collectConsumer = collectConsumer;
        this.settleTurnConsumer = settleTurnConsumer;
        this.chance = new Chance();
    }

    async start() {
        await super.start();
        await this.proceedUnsettledBets();
    }

    async getLastArchiveRound() {
        const { configName } = this.definition;
        const archiveStatus = await this.archiveStatusesRepository.findOne({ name: configName }, "lastArcId").lean().exec();

        return archiveStatus ? archiveStatus.lastArcId["_rounds"] + 1 : 1;
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
        unsettledBets.forEach((bet) => {
            this.gameData.ingame[bet.name] = {
                betTracks: {
                    ...bet,
                    turnResult: { isLose: false, betwin: bet.totalTurns === 0 ? bet.amount : bet.betwin },
                },
            };
        });

        await Promise.all(
            Object.values(this.gameData.ingame).map((player) => this.settleGameRoundConsumer.settleBets(player.betTracks.name))
        );
    }

    async enableGame() {
        await Promise.all(
            Object.values(this.gameData.ingame).map(async (player) => {
                if (player.betTracks && Object.keys(player.betTracks).length) {
                    const bet = player.betTracks;
                    bet.turnResult = {
                        isLose: false,
                        betwin: bet.totalTurns === 0 ? bet.amount : bet.betwin,
                    };

                    await this.settleGameRoundConsumer.settleBets(bet.name);
                }
            })
        );

        await super.enableGame();
    }
}
