import { Actions, MaxCombinedClientSeeds } from "../constants";

export class UnsettledBetConsumer {
    constructor(gameData, betsRepository, betLogsRepository, tempBetsRepository, settleGameRoundConsumer, roundResultConsumer) {
        this.gameData = gameData;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.tempBetsRepository = tempBetsRepository;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.roundResultConsumer = roundResultConsumer;
    }

    async proceed() {
        const unsettledBets = await this.getUnsettledBets();

        if (unsettledBets.length > 0) {
            await this.generateResult(unsettledBets);
            const betLogs = await this.betLogsRepository.find({ roundId: this.gameData.roundId }).lean().exec();
            const newBetLogs = [];

            for (const bet of unsettledBets.filter((x) => x.playerId)) {
                const betLog = betLogs.filter((x) => x.playerId === bet.playerId);

                if (!betLog.some((x) => x.action === Actions.CashOut)) {
                    const halfCashOutLog = betLog.find((x) => x.action === Actions.HalfCashOut);
                    const amount = halfCashOutLog ? halfCashOutLog.amount : bet.amount;
                    newBetLogs.push({
                        uid: bet.uid,
                        name: bet.name,
                        time: new Date(),
                        action: Actions.Refund,
                        amount: amount,
                        winAmount: amount,
                        clientSendTime: new Date(),
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

            await this.betLogsRepository.insertMany(newBetLogs);
            await this.settleGameRoundConsumer.settleRound();
        }
    }

    async generateResult(unsettledBets) {
        if (this.gameData.lastResultRecord.finalHash) {
            await this.roundResultConsumer.generateServerSeedAndPublishHash(this.gameData.lastResultRecord);
        } else {
            this.gameData.setServerSeed(this.gameData.lastResultRecord.serverSeed);
            this.updateClientSeeds(unsettledBets);
            await this.roundResultConsumer.generateResult();
        }
    }

    updateClientSeeds(unsettledBets) {
        const sortedBets = [...unsettledBets].sort((b1, b2) => b1.time - b2.time);
        sortedBets.slice(0, MaxCombinedClientSeeds).forEach(({ name, clientSeed }) => this.gameData.addClientSeed({ name, clientSeed }));
    }

    async getUnsettledBets() {
        const playerBets = await this.betsRepository.find({ paid: false, roundId: this.gameData.roundId }).lean().exec();
        const botBets = await this.tempBetsRepository.find({ paid: false, roundId: this.gameData.roundId }).lean().exec();

        return playerBets.concat(botBets);
    }
}
