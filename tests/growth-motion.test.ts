import test from "node:test";
import assert from "node:assert/strict";
import { GROWTH_DURATION, SEED, growthPose, solveArm } from "../lib/growth-motion";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test("arms keep their proportions and move continuously through the full story", () => {
    let previous = growthPose(0);
    for (let at = 16; at <= GROWTH_DURATION; at += 16) {
        const pose = growthPose(at);
        for (const [name, upper, lower] of [["near", 77, 74], ["far", 74, 70]] as const) {
            const arm = pose[name];
            assert.ok(Math.abs(distance(arm.shoulder, arm.elbow) - upper) < 1e-7);
            assert.ok(Math.abs(distance(arm.elbow, arm.wrist) - lower) < 1e-7);
            for (const joint of ["shoulder", "elbow", "wrist"] as const) {
                assert.ok(Number.isFinite(arm[joint].x) && Number.isFinite(arm[joint].y));
                assert.ok(distance(arm[joint], previous[name][joint]) < 2, `${name} ${joint} jumps at ${at}`);
            }
        }
        previous = pose;
    }
});

test("the hand can reach the seed before water falls and growth follows impact", () => {
    const receiving = growthPose(6500), bending = growthPose(11000);
    assert.equal(receiving.open, 1);
    assert.equal(receiving.poolOpacity, 1);
    assert.equal(receiving.lean, 0);
    assert.equal(bending.lean, 1);
    assert.equal(bending.stem, 0);
    assert.ok(bending.near.wrist.x > receiving.near.wrist.x + 60);
    assert.ok(bending.near.wrist.y > receiving.near.wrist.y + 70);
    let previousY = growthPose(11150).drop.y;
    for (let at = 11160; at <= 11800; at += 10) {
        const pose = growthPose(at);
        assert.ok(pose.drop.y >= previousY);
        assert.ok(Math.abs(pose.drop.x - SEED.x) < .2);
        assert.equal(pose.stem, 0);
        previousY = pose.drop.y;
    }
    assert.deepEqual(growthPose(11800).drop, SEED);
    assert.ok(growthPose(12400).stem > 0);
});

test("the final pose holds a grown plant and the rig handles unreachable targets", () => {
    const final = growthPose(GROWTH_DURATION);
    assert.equal(final.stem, 1);
    assert.ok(final.leaves.every(value => value === 1));
    assert.equal(final.seedOpacity, 0);
    assert.equal(final.settle, 1);
    assert.deepEqual(final, growthPose(GROWTH_DURATION + 5000));
    for (const target of [{ x: 0, y: 0 }, { x: 10000, y: -10000 }]) {
        const arm = solveArm({ x: 0, y: 0 }, target);
        assert.ok(Number.isFinite(arm.elbow.x));
        assert.ok(Number.isFinite(arm.elbow.y));
    }
});
