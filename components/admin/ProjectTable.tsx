import { bookings } from "@/lib/data";
import { shortDate } from "@/lib/dates";

export function ProjectTable() {
  return (
    <section className="panel span-2">
      <h2>Recent Bookings</h2>
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
          {bookings.map((booking) => (
            <tr key={`${booking.client}-${booking.eventDate}`}>
              <td>{booking.client}</td>
              <td>{booking.eventType}</td>
              <td>{shortDate(booking.eventDate)}</td>
              <td><span className="status">{booking.status}</span></td>
              <td>{booking.payment}</td>
              <td>{booking.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
