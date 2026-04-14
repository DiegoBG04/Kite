/**
 * Profile.jsx — User Profile and Settings Page
 *
 * Purpose: Displays account info, notification preferences, and app settings
 * (briefing delivery time, news source preferences). No backend integration
 * needed for MVP — settings are stored locally until auth is built (Week 7).
 *
 * TODO (Step 8): Implement preference toggles with local state.
 */

export default function Profile() {
  return (
    <div>
      <h2>Profile</h2>

      <section>
        <h3>Account</h3>
        <p>Username: —</p>
        <p>Email: —</p>
      </section>

      <section>
        <h3>Notifications</h3>
        {/* TODO: implement toggle components */}
        <p>Daily briefing: <input type="checkbox" defaultChecked /></p>
        <p>Risk flag alerts: <input type="checkbox" defaultChecked /></p>
      </section>

      <section>
        <h3>Settings</h3>
        <p>Briefing time: <input type="time" defaultValue="06:00" /></p>
      </section>
    </div>
  );
}
