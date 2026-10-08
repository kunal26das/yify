const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');
const {load} = require('js-yaml');

const workflow = name => load(readFileSync(join(__dirname, '../.github/workflows', name), 'utf8'));

test('only confirmed automatic merges can dispatch main CI with a separate write token', () => {
    const maintenance = workflow('dependabot-maintenance.yml');
    const merge = maintenance.jobs.maintain;
    const dispatch = maintenance.jobs['validate-merged-main'];
    assert.equal(merge.permissions.actions, 'read');
    assert.equal(merge.outputs.merged, '${{ steps.merge.outputs.merged }}');
    assert.equal(dispatch.needs, 'maintain');
    assert.equal(dispatch.if, "needs.maintain.outputs.merged == 'true'");
    assert.deepEqual(dispatch.permissions, {contents: 'read', 'pull-requests': 'read', actions: 'write'});
    assert.equal(dispatch.steps[0].with.ref, '${{ github.sha }}');
    assert.equal(dispatch.steps[0].with['persist-credentials'], false);
    const action = dispatch.steps.find(step => step.run === 'node scripts/main-ci.mjs dispatch');
    assert.equal(action.env.PR_NUMBER, '${{ needs.maintain.outputs.pr }}');
    assert.equal(action.env.PR_HEAD_SHA, '${{ needs.maintain.outputs.head }}');
    assert.equal(action.env.GH_TOKEN, '${{ secrets.GITHUB_TOKEN }}');
    assert.ok(dispatch.steps.every(step => !/yarn|npm|npx/.test(step.run ?? '')));
});

for (const name of ['deploy-hosting.yml', 'deploy-pages.yml']) {
    test(`${name} publishes automatic updates only after current main passes CI`, () => {
        const delivery = workflow(name);
        assert.equal(delivery.on.push, undefined);
        assert.deepEqual(delivery.on.workflow_run, {workflows: ['CI'], branches: ['main'], types: ['completed']});
        assert.ok(Object.hasOwn(delivery.on, 'workflow_dispatch'));
        const verify = delivery.jobs.verify;
        assert.match(verify.if, /workflow_run.conclusion == 'success'/);
        assert.match(verify.if, /\["push","workflow_dispatch"\]/);
        assert.match(verify.if, /workflow_run.head_repository.full_name == github.repository/);
        assert.deepEqual(verify.permissions, {contents: 'read', actions: 'read'});
        assert.equal(verify.steps[0].with.ref, '${{ github.sha }}');
        assert.equal(verify.steps[0].with['persist-credentials'], false);
        const check = verify.steps.find(step => step.id === 'ci');
        assert.equal(check.run, 'node scripts/main-ci.mjs validate');
        assert.equal(check.env.SOURCE_RUN_ID, '${{ github.event.workflow_run.id }}');
        assert.equal(check.env.SOURCE_RUN_ATTEMPT, '${{ github.event.workflow_run.run_attempt }}');
        const build = delivery.jobs.build ?? delivery.jobs.deploy;
        assert.equal(build.needs, 'verify');
        assert.equal(build.if, "needs.verify.outputs.ready == 'true'");
        assert.equal(build.steps[0].with.ref, '${{ needs.verify.outputs.head }}');
        assert.equal(build.steps[0].with['persist-credentials'], false);
        assert.equal(delivery.concurrency, undefined);
        const publish = delivery.jobs.deploy;
        assert.equal(publish.concurrency['cancel-in-progress'], false);
        assert.equal(publish.concurrency.queue, 'max');
        const current = publish.steps.findIndex(step => step.run === 'node scripts/main-ci.mjs current');
        const promote = publish.steps.findIndex(step => /eas\.sh deploy/.test(step.run ?? '') || step.uses?.startsWith('actions/deploy-pages@'));
        assert.ok(current >= 0 && current < promote);
        assert.equal(publish.steps[current].env.SOURCE_RUN_ID, '${{ github.event.workflow_run.id }}');
        assert.equal(publish.steps[current].env.SOURCE_RUN_ATTEMPT, '${{ github.event.workflow_run.run_attempt }}');
    });
}

test('automatic Hosting delivery promotes production while manual previews remain previews', () => {
    const delivery = workflow('deploy-hosting.yml');
    assert.equal(delivery.on.workflow_dispatch.inputs.production.default, false);
    const steps = delivery.jobs.deploy.steps;
    const current = steps.find(step => step.run === 'node scripts/main-ci.mjs current');
    assert.equal(current.env.CHECK_CURRENT_MAIN, "${{ github.event_name == 'workflow_run' || inputs.production }}");
    const deploy = steps.find(step => /eas\.sh deploy/.test(step.run ?? ''));
    assert.match(deploy.run, /github.event_name == 'workflow_run' \|\| inputs.production/);
    assert.match(deploy.run, /'--prod'/);
    assert.match(deploy.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT, /'production' \|\| 'preview'/);
});
