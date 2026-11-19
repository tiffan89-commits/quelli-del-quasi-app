export const SUBMISSION_REMINDER_HOURS=[24,12,6,3];
export const REMINDER_WINDOW_MS=20*60000;
export const isReminderDue=(deadline,now,lead)=>deadline>now&&deadline-now<=lead*3600000&&deadline-now>=lead*3600000-REMINDER_WINDOW_MS;
