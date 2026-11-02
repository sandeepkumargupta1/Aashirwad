import test from "node:test";
import assert from "node:assert/strict";
import { photoStory, STORY_DURATION } from "../lib/photo-story";

test("photo transitions stay continuous and do not reveal a blank scene", () => {
    let previous = photoStory(0);
    for (let at = 16; at <= STORY_DURATION; at += 16) {
        const pose = photoStory(at);
        assert.equal(pose.opacities[0], 1, "The base photograph stays opaque through dissolves");
        assert.ok(Math.abs(pose.frames.reduce((sum, value) => sum + value, 0) - 1) < 1e-8);
        pose.frames.forEach((value, index) => {
            assert.ok(value >= 0 && value <= 1);
            assert.ok(Math.abs(value - previous.frames[index]) < .02);
        });
        previous = pose;
    }
});
test("the watering frame precedes the grown plant and the final view holds", () => {
    assert.deepEqual(photoStory(0).frames, [1, 0, 0, 0]);
    assert.deepEqual(photoStory(7000).frames, [0, 1, 0, 0]);
    assert.deepEqual(photoStory(12000).frames, [0, 0, 1, 0]);
    assert.equal(photoStory(12000).stage, 2);
    assert.deepEqual(photoStory(STORY_DURATION).frames, [0, 0, 0, 1]);
    assert.deepEqual(photoStory(STORY_DURATION + 10000), photoStory(STORY_DURATION));
});
