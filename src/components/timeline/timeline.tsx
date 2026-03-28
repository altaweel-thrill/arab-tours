"use client";

import { format } from "date-fns";

export type TimelineEvent = {
  id?: string;
  title: string;
  user?: string;
  date?: Date | null;
  color?: string; // tailwind color class
  description?: string;
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No activity recorded.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {events.map((event, index) => (
        <TimelineItem
          key={event.id || index}
          title={event.title}
          user={event.user}
          date={event.date}
          color={event.color}
          description={event.description}
          isLast={index === events.length - 1}
        />
      ))}
    </div>
  );
}

/* -------------------------------- Item -------------------------------- */

function TimelineItem({
  title,
  user,
  date,
  color = "bg-muted-foreground",
  description,
  isLast,
}: {
  title: string;
  user?: string;
  date?: Date | null;
  color?: string;
  description?: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex gap-4">
      {/* LINE + DOT */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        {!isLast && <div className="flex-1 w-px bg-border mt-1" />}
      </div>

      {/* CONTENT */}
      <div className="pb-2">
        <p className="font-medium">{title}</p>

        {user && (
          <p className="text-sm text-muted-foreground">
            By <span className="font-medium">{user}</span>
          </p>
        )}

        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-1">
          {date ? format(date, "yyyy-MM-dd HH:mm") : "-"}
        </p>
      </div>
    </div>
  );
}