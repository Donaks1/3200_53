// caseOperations.u3.test.ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "./db";
import {
    createCase,
    getCase,
    updateSegmentState,
    removeSegmentState,
    setAllSegmentStates,
} from "./caseOperation";
import type { CaseRecord } from "./types";

type SegmentState = CaseRecord["segmentStates"][string];

// TODO: replace with real values from your SegmentState type
const STATE_A = "present" as unknown as SegmentState;
const STATE_B = "absent" as unknown as SegmentState;
const STATE_C = "fragmentary" as unknown as SegmentState;

const CONTEXT_ID = "context-1";

async function makeCase() {
    return createCase(CONTEXT_ID, {
        caseName: "Test Case",
        sex: "unknown",
        ageGroup: "adult",
    } as Parameters<typeof createCase>[1]);
}

describe("U3: caseOperation (bone states)", () => {
    beforeEach(async () => {
        await db.cases.clear();
        // Fake only Date so Dexie / fake-indexeddb timers keep working
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** Move the clock forward so dateModified must differ from the previous value. */
    const tick = (ms = 1000) => vi.advanceTimersByTime(ms);

    it("createCase starts with empty segmentStates", async () => {
        const created = await makeCase();
        const stored = await getCase(created.caseId);

        expect(stored).toBeDefined();
        expect(stored!.segmentStates).toEqual({});
    });

    describe("updateSegmentState", () => {
        it("saves a new segment state and bumps dateModified", async () => {
            const created = await makeCase();
            tick();

            await updateSegmentState(created.caseId, "skull", STATE_A);

            const stored = await getCase(created.caseId);
            expect(stored!.segmentStates).toEqual({ skull: STATE_A });
            expect(stored!.dateModified).not.toBe(created.dateModified);
            expect(new Date(stored!.dateModified).getTime()).toBeGreaterThan(
                new Date(created.dateModified).getTime()
            );
        });

        it("overwrites an existing state without touching other segments", async () => {
            const created = await makeCase();
            await updateSegmentState(created.caseId, "skull", STATE_A);
            await updateSegmentState(created.caseId, "femur_l", STATE_B);
            tick();

            await updateSegmentState(created.caseId, "skull", STATE_C);

            const stored = await getCase(created.caseId);
            expect(stored!.segmentStates).toEqual({
                skull: STATE_C,
                femur_l: STATE_B,
            });
        });

        it("does not change dateCreated or other fields", async () => {
            const created = await makeCase();
            tick();

            await updateSegmentState(created.caseId, "skull", STATE_A);

            const stored = await getCase(created.caseId);
            expect(stored!.dateCreated).toBe(created.dateCreated);
            expect(stored!.caseName).toBe(created.caseName);
            expect(stored!.contextId).toBe(CONTEXT_ID);
        });

        it("throws if the case does not exist", async () => {
            await expect(
                updateSegmentState("missing-id", "skull", STATE_A)
            ).rejects.toThrow("Case not found");
        });
    });

    describe("removeSegmentState", () => {
        it("removes only the given segment and bumps dateModified", async () => {
            const created = await makeCase();
            await updateSegmentState(created.caseId, "skull", STATE_A);
            await updateSegmentState(created.caseId, "femur_l", STATE_B);
            const before = await getCase(created.caseId);
            tick();

            await removeSegmentState(created.caseId, "skull");

            const stored = await getCase(created.caseId);
            expect(stored!.segmentStates).toEqual({ femur_l: STATE_B });
            expect(stored!.segmentStates).not.toHaveProperty("skull");
            expect(stored!.dateModified).not.toBe(before!.dateModified);
        });

        it("is a no-op on the data when the segment does not exist", async () => {
            const created = await makeCase();
            await updateSegmentState(created.caseId, "skull", STATE_A);

            await removeSegmentState(created.caseId, "never-set");

            const stored = await getCase(created.caseId);
            expect(stored!.segmentStates).toEqual({ skull: STATE_A });
        });

        it("throws if the case does not exist", async () => {
            await expect(
                removeSegmentState("missing-id", "skull")
            ).rejects.toThrow("Case not found");
        });
    });

    describe("setAllSegmentStates", () => {
        it("replaces all states and bumps dateModified", async () => {
            const created = await makeCase();
            await updateSegmentState(created.caseId, "skull", STATE_A);
            const before = await getCase(created.caseId);
            tick();

            const replacement = { femur_l: STATE_B, tibia_r: STATE_C };
            await setAllSegmentStates(created.caseId, replacement);

            const stored = await getCase(created.caseId);
            expect(stored!.segmentStates).toEqual(replacement);
            expect(stored!.segmentStates).not.toHaveProperty("skull");
            expect(stored!.dateModified).not.toBe(before!.dateModified);
        });

        it("can clear everything with an empty object", async () => {
            const created = await makeCase();
            await updateSegmentState(created.caseId, "skull", STATE_A);

            await setAllSegmentStates(created.caseId, {});

            const stored = await getCase(created.caseId);
            expect(stored!.segmentStates).toEqual({});
        });

        it("throws if the case does not exist", async () => {
            await expect(
                setAllSegmentStates("missing-id", {})
            ).rejects.toThrow("Case not found");
        });
    });

    it("full flow: create → update → remove → setAll, reading back each time", async () => {
        const created = await makeCase();
        const stamps = [created.dateModified];

        tick();
        await updateSegmentState(created.caseId, "skull", STATE_A);
        let stored = await getCase(created.caseId);
        expect(stored!.segmentStates).toEqual({ skull: STATE_A });
        stamps.push(stored!.dateModified);

        tick();
        await removeSegmentState(created.caseId, "skull");
        stored = await getCase(created.caseId);
        expect(stored!.segmentStates).toEqual({});
        stamps.push(stored!.dateModified);

        tick();
        await setAllSegmentStates(created.caseId, { femur_l: STATE_B });
        stored = await getCase(created.caseId);
        expect(stored!.segmentStates).toEqual({ femur_l: STATE_B });
        stamps.push(stored!.dateModified);

        // every step produced a new, strictly later timestamp
        expect(new Set(stamps).size).toBe(stamps.length);
        const times = stamps.map((s) => new Date(s).getTime());
        expect([...times].sort((a, b) => a - b)).toEqual(times);
    });
});