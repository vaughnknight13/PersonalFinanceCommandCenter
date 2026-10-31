import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="stack">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to the dashboard</Link>
      </p>
    </div>
  );
}