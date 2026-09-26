import {
  CalendarCheck,
  CalendarClock,
  CircleArrowLeft,
  CircleCheckBig,
  CircleHelp,
  Coffee,
  Inbox,
  Laptop,
  House,
  Phone,
  ShoppingBag,
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
  "@phone": Phone,
  "@computer": Laptop,
  "@errand": ShoppingBag,
  "@home": House,
};
