import { handler, notFound, resolveId } from "@/lib/api";
import { markProjectReviewed } from "@/lib/review";

// Marks the project reviewed now; the next review comes due after its cadence.
export const POST = handler(async (_request, { params }: RouteContext<"/api/projects/[id]/review">) => {
  const id = await resolveId(params, "Project");
  const project = await markProjectReviewed(id);
  if (!project) throw notFound("Project");
  return Response.json(project);
});
