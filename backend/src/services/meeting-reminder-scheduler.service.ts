import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin as defaultSupabase } from '../db/supabase';
import { TaskJobService } from './task-job.service';

export interface SchedulerExecutionResult {
  meetingsEvaluated: number;
  remindersDispatched: number;
  duplicatesSkipped: number;
  tasksEvaluated: number;
  timestamp: string;
}

export class MeetingReminderSchedulerService {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  constructor(private supabase: SupabaseClient = defaultSupabase) {}

  /**
   * Starts the recurring background scheduler loop (runs every 60 seconds)
   */
  public static startScheduler(intervalMs = 60000) {
    if (this.timer) return;

    const instance = new MeetingReminderSchedulerService();
    console.log(`[MeetingReminderScheduler] Started background reminder engine (interval: ${intervalMs}ms)`);

    // Run immediately once
    instance.runEvaluationCycle().catch(err => {
      console.error('[MeetingReminderScheduler] Error during initial cycle:', err);
    });

    this.timer = setInterval(() => {
      if (this.isRunning) return;
      this.isRunning = true;
      instance.runEvaluationCycle()
        .catch(err => {
          console.error('[MeetingReminderScheduler] Cycle error:', err);
        })
        .finally(() => {
          this.isRunning = false;
        });
    }, intervalMs);
  }

  /**
   * Stops the background scheduler
   */
  public static stopScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[MeetingReminderScheduler] Stopped background reminder engine.');
    }
  }

  /**
   * Main evaluation cycle for meeting reminders & task alerts across active organizations
   */
  async runEvaluationCycle(): Promise<SchedulerExecutionResult> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let remindersDispatched = 0;
    let duplicatesSkipped = 0;
    let tasksEvaluated = 0;

    // 1. Fetch upcoming meetings for today or tomorrow (for 24h reminders)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: meetings, error } = await this.supabase
      .from('meetings')
      .select(`
        id,
        organization_id,
        title,
        meeting_date,
        meeting_time,
        end_time,
        status,
        location_or_link,
        organizer_id,
        meeting_type
      `)
      .in('status', ['SCHEDULED', 'IN_PROGRESS'])
      .in('meeting_date', [todayStr, tomorrowStr]);

    if (error || !meetings) {
      return {
        meetingsEvaluated: 0,
        remindersDispatched: 0,
        duplicatesSkipped: 0,
        tasksEvaluated: 0,
        timestamp: now.toISOString(),
      };
    }

    // 2. Evaluate reminder offsets for each meeting
    for (const m of meetings) {
      if (!m.meeting_time) continue;

      const [startH, startM] = m.meeting_time.split(':').map(Number);
      const meetingDateTime = new Date(`${m.meeting_date}T00:00:00`);
      meetingDateTime.setHours(startH, startM, 0, 0);

      // End time
      const meetingEndDateTime = new Date(meetingDateTime);
      if (m.end_time) {
        const [endH, endM] = m.end_time.split(':').map(Number);
        meetingEndDateTime.setHours(endH, endM, 0, 0);
      } else {
        meetingEndDateTime.setHours(startH + 1, startM, 0, 0);
      }

      const diffMs = meetingDateTime.getTime() - now.getTime();
      const diffMinutes = Math.round(diffMs / (60 * 1000));

      const diffEndMs = now.getTime() - meetingEndDateTime.getTime();
      const diffEndMinutes = Math.round(diffEndMs / (60 * 1000));

      // Recipient is organizer
      const recipientId = m.organizer_id;
      if (!recipientId) continue;

      // Check offset rules:
      // UPCOMING_24H: between 1430 and 1450 mins
      if (diffMinutes >= 1430 && diffMinutes <= 1450) {
        const sent = await this.dispatchMeetingReminder({
          meeting: m,
          recipientId,
          reminderType: 'UPCOMING_24H',
          scheduledAt: meetingDateTime,
          title: `Meeting Tomorrow: ${m.title}`,
          message: `Your meeting "${m.title}" is scheduled for tomorrow at ${m.meeting_time}.`,
          priority: 'MEDIUM',
        });
        if (sent) remindersDispatched++; else duplicatesSkipped++;
      }

      // UPCOMING_1H: between 55 and 65 mins
      if (diffMinutes >= 55 && diffMinutes <= 65) {
        const sent = await this.dispatchMeetingReminder({
          meeting: m,
          recipientId,
          reminderType: 'UPCOMING_1H',
          scheduledAt: meetingDateTime,
          title: `Meeting in 1 Hour: ${m.title}`,
          message: `Meeting "${m.title}" starts in 1 hour (${m.meeting_time}).`,
          priority: 'MEDIUM',
        });
        if (sent) remindersDispatched++; else duplicatesSkipped++;
      }

      // UPCOMING_15M: between 12 and 17 mins
      if (diffMinutes >= 12 && diffMinutes <= 17) {
        const sent = await this.dispatchMeetingReminder({
          meeting: m,
          recipientId,
          reminderType: 'UPCOMING_15M',
          scheduledAt: meetingDateTime,
          title: `Meeting in 15 Minutes: ${m.title}`,
          message: `Meeting "${m.title}" starts at ${m.meeting_time}. Review agenda and preparation notes.`,
          priority: 'HIGH',
        });
        if (sent) remindersDispatched++; else duplicatesSkipped++;
      }

      // UPCOMING_5M: between 3 and 7 mins
      if (diffMinutes >= 3 && diffMinutes <= 7) {
        const sent = await this.dispatchMeetingReminder({
          meeting: m,
          recipientId,
          reminderType: 'UPCOMING_5M',
          scheduledAt: meetingDateTime,
          title: `Meeting in 5 Minutes: ${m.title}`,
          message: `Meeting "${m.title}" begins shortly. Teams/Call link is ready.`,
          priority: 'HIGH',
        });
        if (sent) remindersDispatched++; else duplicatesSkipped++;
      }

      // MEETING_STARTED: between -2 and +3 mins of start time
      if (diffMinutes >= -2 && diffMinutes <= 3) {
        const sent = await this.dispatchMeetingReminder({
          meeting: m,
          recipientId,
          reminderType: 'MEETING_STARTED',
          scheduledAt: meetingDateTime,
          title: `Meeting Started: ${m.title}`,
          message: `Your scheduled meeting "${m.title}" has started. Join call or launch live notes.`,
          priority: 'CRITICAL',
        });
        if (sent) remindersDispatched++; else duplicatesSkipped++;
      }

      // MEETING_ENDED: between 0 and +5 mins of end time
      if (diffEndMinutes >= 0 && diffEndMinutes <= 5) {
        const sent = await this.dispatchMeetingReminder({
          meeting: m,
          recipientId,
          reminderType: 'MEETING_ENDED',
          scheduledAt: meetingEndDateTime,
          title: `Meeting Ended: ${m.title}`,
          message: `Scheduled meeting time has ended. Review notes and record action items.`,
          priority: 'HIGH',
        });
        if (sent) remindersDispatched++; else duplicatesSkipped++;
      }
    }

    // 3. Periodic Task Monitoring (Runs every hour at minute 0)
    if (now.getMinutes() === 0 || now.getMinutes() === 30) {
      try {
        // Collect unique organizations
        const orgIds = Array.from(new Set(meetings.map(m => m.organization_id)));
        for (const orgId of orgIds) {
          const taskJob = new TaskJobService(this.supabase, orgId);
          const result = await taskJob.runDailyMonitoringJob();
          tasksEvaluated += result.processedCount;
        }
      } catch (err) {
        console.warn('[MeetingReminderScheduler] Task monitoring non-blocking error:', err);
      }
    }

    return {
      meetingsEvaluated: meetings.length,
      remindersDispatched,
      duplicatesSkipped,
      tasksEvaluated,
      timestamp: now.toISOString(),
    };
  }

  /**
   * Dispatches a single meeting reminder with idempotency check against meeting_reminders table
   */
  private async dispatchMeetingReminder(params: {
    meeting: any;
    recipientId: string;
    reminderType: string;
    scheduledAt: Date;
    title: string;
    message: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }): Promise<boolean> {
    const dedupKey = `${params.meeting.id}_${params.reminderType}_${params.recipientId}`;

    try {
      // 1. Idempotency check in meeting_reminders table
      const { data: existing } = await this.supabase
        .from('meeting_reminders')
        .select('id, status')
        .eq('organization_id', params.meeting.organization_id)
        .eq('deduplication_key', dedupKey)
        .maybeSingle();

      if (existing) {
        return false; // Already created/sent
      }

      // 2. Record reminder attempt in meeting_reminders
      const { data: reminderRow, error: remErr } = await this.supabase
        .from('meeting_reminders')
        .insert({
          organization_id: params.meeting.organization_id,
          meeting_id: params.meeting.id,
          reminder_type: params.reminderType,
          scheduled_at: params.scheduledAt.toISOString(),
          delivered_at: new Date().toISOString(),
          status: 'SENT',
          delivery_channel: 'IN_APP',
          recipient_user_id: params.recipientId,
          deduplication_key: dedupKey,
        })
        .select()
        .single();

      if (remErr || !reminderRow) {
        // Unique constraint violation or DB error
        return false;
      }

      // 3. Insert into notifications table
      await this.supabase.from('notifications').insert({
        organization_id: params.meeting.organization_id,
        recipient_id: params.recipientId,
        type: `MEETING_${params.reminderType}`,
        title: params.title,
        message: params.message,
        category: 'MEETING',
        priority: params.priority,
        entity_type: 'meeting',
        entity_id: params.meeting.id,
        action_url: `/meetings/${params.meeting.id}`,
        metadata: {
          meeting_id: params.meeting.id,
          reminder_type: params.reminderType,
          meeting_time: params.meeting.meeting_time,
          location_or_link: params.meeting.location_or_link || '',
        },
      });

      return true;
    } catch (err) {
      console.warn(`[MeetingReminderScheduler] Failed dispatch for ${dedupKey}:`, err);
      return false;
    }
  }
}
