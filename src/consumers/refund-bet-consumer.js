import { Actions } from "../constants";

export class RefundBetConsumer {
    constructor({
        gameData,
        definition,
        betsRepository,
        betLogsRepository,
        tempBetsRepository,
        settleGameRoundConsumer,
        roundResultConsumer,
        provablyFairConsumer,
    }) {
        this.gameData = gameData;
        this.definition = definition;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.tempBetsRepository = tempBetsRepository;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.roundResultConsumer = roundResultConsumer;
        this.provablyFairConsumer = provablyFairConsumer;
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
        const { serverSeed, serverSeedHash, finalHash } = this.gameData.lastResultRecord;

        if (finalHash) {
            this.gameData.result = this.definition.generateResult(finalHash);
        } else {
            this.provablyFairConsumer.updateClientSeeds(this.provablyFairConsumer.generateClientSeeds(unsettledBets));
            this.provablyFairConsumer.addServerSeed(serverSeed);

            //TODO move to provablyFairConsumer
            this.gameData.setServerSeedHash(serverSeedHash);
            await this.roundResultConsumer.generateResult();
        }
    }

    async getUnsettledBets() {
        const playerBets = await this.betsRepository.find({ paid: false, roundId: this.gameData.roundId }).lean().exec();
        const botBets = await this.tempBetsRepository.find({ paid: false, roundId: this.gameData.roundId }).lean().exec();

        return playerBets.concat(botBets);
    }
}
