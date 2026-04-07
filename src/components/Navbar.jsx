import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

function Navbar({ cartCount, onCartClick }) {
  const isCartEmpty = cartCount === 0;

  return (
    <nav className="sticky top-0 z-50 border-b border-orange-200/60 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logo}
            alt="FoodiefyCo"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-orange-100"
          />
          <div>
            <p className="text-lg font-bold tracking-tight text-gray-900">
              FoodiefyCo
            </p>
            <p className="text-xs text-gray-500">Fresh meals, delivered fast</p>
          </div>
        </Link>

        <button
          onClick={onCartClick}
          disabled={isCartEmpty}
          className="relative inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
        >
          <span>Cart</span>
          {cartCount > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-orange-600">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
