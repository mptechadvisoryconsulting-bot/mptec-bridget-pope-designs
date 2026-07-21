import { StatusBadge } from "@/components/ui/StatusBadge";
import { shortDate } from "@/lib/dates";

type ProjectRow = {
  client: string;
  eventType: string;
  eventDate: string;
  status: string;
  payment: string;
  total: string;
};

export function ProjectTable({ rows = [] }: { rows?: ProjectRow[] }) {
  return (
    <section className="panel span-2">
      <h2>Recent Projects</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Event Type</th>
            <th>Event Date</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((booking) => (
            <tr key={`${booking.client}-${booking.eventDate}`}>
              <td>{booking.client}</td>
              <td>{booking.eventType}</td>
              <td>{booking.eventDate ? shortDate(booking.eventDate) : "Not set"}</td>
              <td><StatusBadge status={booking.status} /></td>
              <td>{booking.payment}</td>
              <td>{booking.total}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={6}>No synced projects yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
