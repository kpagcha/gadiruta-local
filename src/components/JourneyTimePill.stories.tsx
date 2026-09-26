import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { shiftCalendarDate } from '../data/calendar-date.ts';
import { madridToday } from '../data/calendar-date.ts';
import { JourneyDatePill } from './JourneyDatePill';
import { JourneyTimePill } from './JourneyTimePill';

const today = madridToday();
const maximum = `${Number(today.slice(0, 4)) + 1}-12-31`;

/** Show the date beside the time so midnight changes are visible in Storybook. */
function TimePillStory({ initialDate, initialTime }: { initialDate: string; initialTime: string }) {
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  return (
    <div className="w-fit rounded-3xl border border-line bg-surface-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap gap-2">
        <JourneyDatePill value={date} onChange={setDate} minimum={today} maximum={maximum} disabled={false} />
        <JourneyTimePill
          date={date}
          value={time}
          onChange={(nextDate, nextTime) => {
            setDate(nextDate);
            setTime(nextTime);
          }}
          minimum={today}
          maximum={maximum}
          disabled={false}
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Journey time pill',
  component: JourneyTimePill,
  render: ({ date, value }) => <TimePillStory initialDate={date} initialTime={value} />,
  args: {
    date: today,
    value: '',
    minimum: today,
    maximum,
    disabled: false,
    onChange: ignoreStoryChange,
  },
} satisfies Meta<typeof JourneyTimePill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Storybook supplies the real callback inside the interactive preview. */
function ignoreStoryChange() {}

export const Blank: Story = {};
export const ExactMinute: Story = { args: { value: '17:07' } };
export const NearMidnight: Story = { args: { date: shiftCalendarDate(today, 1), value: '23:50' } };
