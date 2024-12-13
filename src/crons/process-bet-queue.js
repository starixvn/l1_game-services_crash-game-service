import { Core } from "sc-game-base";
import { tracer } from "sc-instrument";
import { Actions } from "../constants";
import { generateTapResult } from "../helpers/crash-point-helper";
import noticeHelper from "../helpers/notice-helper";

export default class ProcessBetQueue extends Core.Crons.ProcessBetQueue {
    constructor({
        definition,
        gameData,
        placeBetPublisher,
        placeBet,
        logService,
        betsRepository,
        betLogsRepository,
        userInfosRepository,
        baseMetrics,
        settleCashOutConsumer,
        provablyFairConsumer,
        roundResultConsumer,
        roundsRepository,
        mineConsumer,
    }) {
        super({
            definition,
            gameData,
            placeBetPublisher,
            placeBet,
            logService,
            betsRepository,
            betLogsRepository,
            userInfosRepository,
            baseMetrics,
        });

        this.settleCashOutConsumer = settleCashOutConsumer;
        this.provablyFairConsumer = provablyFairConsumer;
        this.roundResultConsumer = roundResultConsumer;
        this.roundsRepository = roundsRepository;
        this.mineConsumer = mineConsumer;
    }

    dequeueBets() {
        if (this.gameData.ingame) {
            Object.values(this.gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const self = this;
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;

                    tracer.startActiveSpan("dequeueBet", async (span) => {
                        self.proceedActions(player, payload)
                            .then(() => (playerInGame.betProcessing = false))
                            .catch(self.logService.logError)
                            .finally(() => span.end());
                    });
                }
            });
        }
    }

    async proceedActions(player, payload) {
        switch (payload.action) {
            case Actions.Bet:
                await this.proceedBet(player, payload);
                break;
            case Actions.Mine: //TODO: use mine consumer instead of proceedMine
                await this.proceedMine(player, payload);
                break;
            case Actions.CashOut:
                await this.settleCashOutConsumer.proceedCashOut(player, payload);
                //TODO: call settle-game-round-consumer to settle player bet
                break;
        }
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        const rate = this.calculateCurrencyRate(player.session);
        const playerName = player.profile.name;

        //TODO: insert new round, with roundId increment by 1
        await this.insertBet(player, roundId, bet, rate);
        await this.insertBetLog(player, roundId, bet);

        this.notifyPlacingBetResult(player, balance, bet, rate);

        this.gameData.addPlayerToBetList(player.UID, {
            name: playerName,
            amount: bet.amount,
            rate,
            autoCashOut: bet.autoCashOut,
        });

        if (!bet.freeBet && (player.profile.minBet !== balance.minBet || player.profile.maxBet !== balance.maxBet)) {
            await this.updateUserStakeLevel(player, balance.minBet, balance.maxBet);
        }
    }

    generatePlacingBetResult(player, balance, bet, rate) {
        const { amount } = bet;
        const result = super.generatePlacingBetResult(player, balance, bet, rate);
        result.ownChip = { amount };
        result.user.name = player.profile.name;
        return result;
    }

    async insertBetLog(player, roundId, bet) {
        const rate = this.calculateCurrencyRate(player.session);

        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            action: bet.action,
            amount: bet.amount,
            winAmount: bet.winAmount,
            freeBet: bet.freeBet,
            increment: bet.increment,
            result: bet.result,
            multiplier: bet.multiplier,
            clientSendTime: bet.clientSendTime,
            receivedTime: bet.receivedTime,
            roundId,
            tapCount: bet.tapCount,
        };

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.rate = rate;

            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
        }

        await this.betLogsRepository.create(newBetLog);
    }

    async insertBet(player, roundId, bet, rate) {
        const newBet = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            freeBet: bet.freeBet,
            roundId,
            amount: bet.amount,
            autoCashOut: bet.autoCashOut,
            clientSeed: bet.clientSeed,
            totalAmount: bet.amount,
        };

        if (player.session) {
            newBet.siteId = player.session.siteId;
            newBet.currency = player.session.currencyName;
            newBet.rate = rate;

            newBet.operatorId = player.session.operatorId;
            newBet.playerId = player.session.playerId;
        }

        await this.betsRepository.create(newBet);
        return newBet.time;
    }

    decreaseBetTracks(playerName) {
        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            delete playerInGame.betTracks[Actions.Bet];
        }
    }

    async proceedMine(player, payload) {
        const playerGameData = this.gameData.ingame[player.profile.name];

        if (playerGameData?.activeBet) {
            await this.mineConsumer.mine(player, payload);
        } else {
            await this.initializeNewBet(player, payload);
        }
    }

    async initializeNewBet(player, payload) {
        const playerName = player.profile.name;
        const roundId = this.gameData.roundId;
        const result = this.roundResultConsumer.generateResult();

        // Initialize round document
        await this.initializeRound(roundId, result, playerName, payload.amount);

        // Initialize player game state
        await this.initializePlayerGameState(player, payload, roundId);

        // Proceed with bet handling
        await this.proceedBet(player, payload);
    }

    async initializeRound(roundId, result, playerName, betAmount) {
        await this.roundsRepository.create({
            id: roundId,
            result: result,
            time: new Date(),
            exchangeRateId: this.gameData.exchangeRates.id,
            tapCount: 1,
            playerName: playerName,
            betAmount: betAmount,
        });
    }

    async initializePlayerGameState(player, payload, roundId) {
        const playerName = player.profile.name;
        const playerGameData = this.gameData.ingame[playerName];
        const playerBetTracks = playerGameData?.betTracks ?? {};

        playerBetTracks[Actions.Bet].roundId = roundId;
        playerBetTracks[Actions.Bet].tapCount = 1;
    }
}
