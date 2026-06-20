import Icon from "../components/Icon";

function Attendance() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Participation</span>
          <h1>Attendance</h1>
          <p>Record presence quickly and spot engagement trends over time.</p>
        </div>
        <button className="button button-primary"><Icon name="plus" size={18} />Take attendance</button>
      </header>
      <section className="coming-soon-panel">
        <span className="coming-soon-icon"><Icon name="attendance" size={30} /></span>
        <span className="eyebrow">Built for speed</span>
        <h2>Attendance tracking is coming next</h2>
        <p>One-tap check-in, event records, and clear participation reports will live here.</p>
      </section>
    </div>
  );
}

export default Attendance;
