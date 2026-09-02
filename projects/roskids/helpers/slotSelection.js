/**
 * Slot selection helpers for Book Service Step 3 dialog.
 * Uses visible slot labels only (no app testID changes required).
 * Selects a contiguous available range totaling REQUIRED_MINUTES (default 120).
 */
const REQUIRED_MINUTES = Number(process.env.BOOK_SERVICE_SLOT_MINUTES || 120);
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/**
 * Parse "H:mm - H:mm" into duration minutes.
 * @param {string} label
 * @returns {number|null}
 */
function parseSlotDurationMinutes(label) {
  const text = String(label || '');
  const m = text.match(
    /(\d{1,2}):(\d{2})\s*(?:AM|PM|am|pm)?\s*-\s*(\d{1,2}):(\d{2})/,
  );
  if (!m) {
    return null;
  }
  let start = Number(m[1]) * 60 + Number(m[2]);
  let end = Number(m[3]) * 60 + Number(m[4]);
  if (end <= start) {
    end += 24 * 60;
  }
  return end - start;
}

/**
 * @param {Array<{index:number,label:string,duration:number,disabled:boolean,el:WebdriverIO.Element}>} slots
 * @param {number} requiredMinutes
 */
function findContiguousRun(slots, requiredMinutes) {
  const available = slots.filter(s => !s.disabled);
  for (let i = 0; i < available.length; i++) {
    let total = 0;
    const run = [];
    for (let j = i; j < available.length; j++) {
      if (run.length > 0 && available[j].index !== run[run.length - 1].index + 1) {
        break;
      }
      run.push(available[j]);
      total += available[j].duration;
      if (total >= requiredMinutes) {
        return { run, totalMinutes: total };
      }
    }
  }
  return null;
}

class SlotSelectionHelper {
  async #isShown(el) {
    try {
      return (await el.isExisting()) && (await el.isDisplayed());
    } catch {
      return false;
    }
  }

  async #tap(el) {
    try {
      const loc = await el.getLocation();
      const size = await el.getSize();
      await browser.execute('mobile: tap', {
        x: Math.round(loc.x + size.width / 2),
        y: Math.round(loc.y + size.height / 2),
      });
    } catch {
      await el.click();
    }
  }

  async waitForDialog(timeout = 30000) {
    await browser.waitUntil(
      async () => {
        const title = await $(
          '-ios predicate string:label == "Select Slot" OR name == "Select Slot"',
        );
        const legend = await $(
          '-ios predicate string:label == "Available" OR name == "Available"',
        );
        return (await this.#isShown(title)) || (await this.#isShown(legend));
      },
      {
        timeout,
        interval: 500,
        timeoutMsg:
          'Book Service automation failed at Step 3: Select Slot dialog did not open',
      },
    );
  }

  /**
   * Collect slot cells by visible time-range labels (e.g. "8:00 - 8:05").
   */
  async #collectVisibleSlots() {
    const texts = await $$(
      '-ios predicate string:label CONTAINS " - " OR name CONTAINS " - "',
    );
    const results = [];
    let index = 0;
    for (const el of texts) {
      if (!(await this.#isShown(el))) {
        continue;
      }
      const label =
        (await el.getAttribute('label').catch(() => null)) ||
        (await el.getAttribute('name').catch(() => null)) ||
        '';
      if (!parseSlotDurationMinutes(label)) {
        continue;
      }
      let isDisabled = false;
      try {
        isDisabled = !(await el.isEnabled());
      } catch {
        isDisabled = false;
      }
      // Parent button may hold enabled state
      if (!isDisabled) {
        try {
          const parent = await el.$('..');
          if (parent && (await parent.isExisting())) {
            const parentEnabled = await parent.isEnabled().catch(() => true);
            if (parentEnabled === false) {
              isDisabled = true;
            }
          }
        } catch {
          // ignore
        }
      }
      results.push({
        index,
        label: String(label),
        duration: parseSlotDurationMinutes(label) || 5,
        disabled: Boolean(isDisabled),
        el,
      });
      index += 1;
    }
    return results;
  }

  /**
   * Select ~2 hours of contiguous available slots for the current day view.
   */
  async selectTwoHoursForDay(day, requiredMinutes = REQUIRED_MINUTES) {
    console.log(
      `[BookService][Slots] Selecting ${requiredMinutes} min for ${day}...`,
    );
    await this.waitForDialog();

    await browser.waitUntil(
      async () => {
        const slots = await this.#collectVisibleSlots();
        const empty = await $(
          '-ios predicate string:label CONTAINS "No time slots available"',
        );
        return slots.length > 0 || (await this.#isShown(empty));
      },
      {
        timeout: 25000,
        interval: 500,
        timeoutMsg: `Book Service automation failed at Step 3: slots not loaded for ${day}`,
      },
    );

    const slots = await this.#collectVisibleSlots();
    const available = slots.filter(s => !s.disabled);

    if (available.length === 0) {
      console.log(
        `[BookService][Slots] Day: ${day} | Status: SKIP (no available slots)`,
      );
      return {
        day,
        requiredMinutes,
        selectedSlots: 0,
        totalMinutes: 0,
        status: 'SKIP',
      };
    }

    const slotDuration = available[0].duration || 5;
    const requiredSlots = Math.ceil(requiredMinutes / slotDuration);
    const match = findContiguousRun(slots, requiredMinutes);

    if (!match) {
      throw new Error(
        `Book Service automation failed at Step 3:\n` +
          `Unable to select ${requiredMinutes} minutes of slots for ${day}.\n` +
          `Available slots: ${available.length}, slot duration≈${slotDuration}m, need≈${requiredSlots}.`,
      );
    }

    const first = match.run[0];
    const last = match.run[match.run.length - 1];

    await this.#tap(first.el);
    await browser.pause(250);
    if (last.index !== first.index) {
      await this.#tap(last.el);
      await browser.pause(250);
    }

    const summary = {
      day,
      requiredMinutes,
      slotDurationMinutes: slotDuration,
      requiredSlots,
      selectedSlots: match.run.length,
      totalMinutes: match.totalMinutes,
      from: first.label,
      to: last.label,
      status: match.totalMinutes >= requiredMinutes ? 'PASS' : 'FAIL',
    };

    console.log(
      `[BookService][Slots] Day: ${day}\n` +
        `  Required duration: ${requiredMinutes} minutes\n` +
        `  Slot duration: ${slotDuration} minutes\n` +
        `  Required slots: ${requiredSlots}\n` +
        `  Selected slots: ${summary.selectedSlots}\n` +
        `  Selected range: ${first.label} … ${last.label}\n` +
        `  Status: ${summary.status}`,
    );

    if (summary.status !== 'PASS') {
      throw new Error(
        `Book Service automation failed at Step 3: duration short for ${day} (${summary.totalMinutes}m < ${requiredMinutes}m)`,
      );
    }

    return summary;
  }

  async tapDialogNextOrDone(isLastDay) {
    const title = isLastDay ? 'Done' : 'Next';
    const candidates = await $$(
      `-ios predicate string:label == "${title}" OR name == "${title}"`,
    );
    if (candidates.length === 0) {
      throw new Error(
        `Book Service automation failed at Step 3: dialog ${title} button not found`,
      );
    }
    // Prefer lowest on screen (dialog footer)
    let best = candidates[0];
    let maxY = -1;
    for (const el of candidates) {
      const loc = await el.getLocation().catch(() => null);
      if (loc && loc.y > maxY) {
        maxY = loc.y;
        best = el;
      }
    }
    await this.#tap(best);
  }

  async selectTwoHoursForAllWeekdays(requiredMinutes = REQUIRED_MINUTES) {
    const results = [];
    for (let i = 0; i < WEEKDAYS.length; i++) {
      const day = WEEKDAYS[i];
      const isLast = i === WEEKDAYS.length - 1;
      const result = await this.selectTwoHoursForDay(day, requiredMinutes);
      results.push(result);
      await this.tapDialogNextOrDone(isLast);
      await browser.pause(800);
      if (!isLast) {
        await this.waitForDialog(20000);
      }
    }
    return results;
  }
}

module.exports = {
  SlotSelectionHelper,
  REQUIRED_MINUTES,
  WEEKDAYS,
  parseSlotDurationMinutes,
};
