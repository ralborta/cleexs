import assert from 'node:assert/strict';
import {
  isValidPortalWeeklyPromptSlot,
  PORTAL_WEEKLY_PROMPT_MAX_SLOT,
  PORTAL_WEEKLY_PROMPT_SLOT_COUNT,
  portalWeeklyPromptSlotRangeError,
} from './portal-weekly-prompts-slots';

assert.equal(PORTAL_WEEKLY_PROMPT_SLOT_COUNT, 40);
assert.equal(PORTAL_WEEKLY_PROMPT_MAX_SLOT, 39);
assert.equal(isValidPortalWeeklyPromptSlot(0), true);
assert.equal(isValidPortalWeeklyPromptSlot(39), true);
assert.equal(isValidPortalWeeklyPromptSlot(4), true);
assert.equal(isValidPortalWeeklyPromptSlot(-1), false);
assert.equal(isValidPortalWeeklyPromptSlot(40), false);
assert.equal(isValidPortalWeeklyPromptSlot(4.5), false);
assert.equal(isValidPortalWeeklyPromptSlot('0'), false);
assert.match(portalWeeklyPromptSlotRangeError(), /0 y 39/);

console.log('portal-weekly-prompts-slots.test.ts OK');
