import { logger } from "sc-common";
import LiveGamePublisher from "../event-publishers/live-game-publisher";
import { calculateCrashTimeInMillisecond, calculateMultiplier } from "../helpers/crash-point-helper";
import { Actions } from "../constants";
import { addMillisecond } from "../helpers/date-helper";

export default class LiveGameCrons {
    /**
     * @param {LiveGamePublisher} dependencies.liveGamePublisher
     * @param {logger} dependencies.logService
     */
    constructor({ liveGamePublisher, logService, gameData }) {
        this.liveGamePublisher = liveGamePublisher;
        this.logService = logService;
        this.gameData = gameData;
    }

    start() {
        const callback = () => {
            this.proceed();
            this.timeoutId = setTimeout(callback, 100);
        };

        this.proceed();
        setTimeout(() => callback(), 100);
    }

    stop() {
        clearTimeout(this.timeoutId);
    }

    proceed() {
        try {
            const currentTime = new Date();
            const liveTime = currentTime - this.gameData.startTime;
            const multiplier = calculateMultiplier(liveTime);

            this.liveGamePublisher.publish(multiplier, liveTime);
            this.proceedAutoCashOut(multiplier);
        } catch (err) {
            this.stop();
            this.logService.logError(err);
        }
    }

    proceedAutoCashOut(multiplier) {
        const inGame = this.gameData.ingame;

        Object.keys(inGame).forEach((playerName) => {
            const playerInGame = inGame?.[playerName];
            const bet = playerInGame?.betTracks?.[Actions.Bet];
            if (bet?.autoCashOut && multiplier >= bet.autoCashOut) {
                const receivedTime = addMillisecond(this.gameData.startTime, calculateCrashTimeInMillisecond(bet.autoCashOut));

                const payload = {
                    roundId: this.gameData.roundId,
                    receivedTime,
                    action: Actions.CashOut,
                };

                const player = Object.values(this.gameData.realPlayers).find(
                    (player) => player.UID === playerInGame.UID && player.socketClient && player.socketClient.connected
                );

                player && playerInGame.betQueue.push({ player, payload });
            }
        });
    }
}
