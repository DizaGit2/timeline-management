import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { mockShifts, mockSchedule, mockEmployees } from "./fixtures";

export const handlers = [
  // GET /api/shifts — week view via from/to params
  http.get("/api/shifts", ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const filtered = mockShifts.filter((s) => {
        const start = new Date(s.startTime);
        return start >= fromDate && start <= toDate;
      });
      return HttpResponse.json(filtered);
    }
    return HttpResponse.json(mockShifts);
  }),

  // PUT /api/shifts/:id — drag-and-drop shift update
  http.put("/api/shifts/:id", async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const shift = mockShifts.find((s) => s.id === params.id);
    if (!shift) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    return HttpResponse.json({ ...shift, ...body });
  }),

  // POST /api/schedules/copy-week — copy shifts from one week to another
  http.post("/api/schedules/copy-week", async ({ request }) => {
    const body = (await request.json()) as {
      sourceWeekStart: string;
      targetWeekStart: string;
    };
    if (!body.sourceWeekStart || !body.targetWeekStart) {
      return HttpResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (body.sourceWeekStart === body.targetWeekStart) {
      return HttpResponse.json({ error: "Cannot copy week to itself" }, { status: 400 });
    }
    const copied = mockShifts.map((s, i) => ({ ...s, id: `copied-shift-${i}` }));
    return HttpResponse.json({ shifts: copied }, { status: 201 });
  }),

  http.get("/api/schedules/:id", ({ params }) => {
    if (params.id !== mockSchedule.id) {
      return HttpResponse.json({ error: "Not found" }, { status: 404 });
    }
    return HttpResponse.json(mockSchedule);
  }),

  http.get("/api/employees", () => {
    return HttpResponse.json(mockEmployees);
  }),
];

export const server = setupServer(...handlers);
