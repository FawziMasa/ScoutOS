import Icon from "../components/Icon";

function Events() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Group calendar</span>
          <h1>Events</h1>
          <p>Plan memorable meetings, adventures, and community projects.</p>
        </div>
        <button className="button button-primary"><Icon name="plus" size={18} />Create event</button>
      </header>
      <section className="coming-soon-panel">
        <span className="coming-soon-icon"><Icon name="events" size={30} /></span>
        <span className="eyebrow">Next module</span>
        <h2>Event planning is coming next</h2>
        <p>The premium foundation is ready. Scheduling, registrations, locations, and reminders will live here.</p>
      </section>
    </div>
  );
}

export default Events;
