import Chance from "chance";
import { Core } from "sc-game-base";

export default class GameCron extends Core.Crons.BaseGameCron {
    async start() {
        await super.start();
        //await this.proceedUnsettledBets();
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
                    //TODO: convert it to approprate Bet || Mine || Cashout
                },
            };
        });

        await Promise.all(
            Object.values(this.gameData.ingame).map((player) => this.settleGameRoundConsumer.settleBets(player.betTracks.name))
        );
    }
}
