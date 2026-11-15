import {
  CalendarCheck,
  CalendarClock,
  CircleArrowLeft,
  CircleCheckBig,
  CircleHelp,
  Brain,
  Coffee,
  Inbox,
  House,
  MapPin,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Task } from "@/db/schema";
import type { ListKey } from "@/lib/lists";

// In RTL "forward" points left, so Next uses a left arrow.
export const listIcons: Record<ListKey, LucideIcon> = {
  inbox: Inbox,
  next: CircleArrowLeft,
  waiting: Coffee,
  scheduled: CalendarCheck,
  deferred: CalendarClock,
  someday: CircleHelp,
  done: CircleCheckBig,
};

export const contextIcons: Record<NonNullable<Task["context"]>, LucideIcon> = {
  "@focus": Brain,
  "@quick": Zap,
  "@out": MapPin,
  "@home": House,
};
