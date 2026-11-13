import { Link } from 'react-router-dom';

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Betterflow trang chủ">
      <span className="brand-mark" aria-hidden="true">
        b
      </span>
      betterflow
    </Link>
  );
}
