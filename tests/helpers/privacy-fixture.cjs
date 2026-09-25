function privacyFixture(analytics = false, adultConfirmed = true) {
    let choices = {adultConfirmed, analytics, youtube: false, updatedAt: '2026-09-25T00:00:00.000Z', noticeVersion: '2026-09-25-v2'};
    const listeners = new Set();
    return {
        getChoices: () => choices,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        updateChoices: next => {
            choices = {...choices, ...next};
            for (const listener of listeners) listener();
        },
    };
}
module.exports = {privacyFixture};
