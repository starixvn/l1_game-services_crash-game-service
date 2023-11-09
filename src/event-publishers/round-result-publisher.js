import { Core } from "sc-game-base";

export default class RoundResultPublisher extends Core.BaseEventPublishers.RoundResultPublisher {
    publishRoundResult(roundResult) {
        const payload = { finish: roundResult };

        if (this.gameData.resultHash.rawValue) {
            this.publishToAllUsers({
                ...payload,
                resultHash: { ...this.gameData.resultHash, extraInfos: this.gameData.result },
            });
        } else {
            this.publishToAllUsers(payload);
        }

        this.publishToAllAdmins(payload);
    }
}
