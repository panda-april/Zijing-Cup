import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <h1 className="text-8xl font-black text-gray-200 mb-4">404</h1>
      <p className="text-xl font-bold text-gray-500 mb-8">Page Not Found</p>
      <Link
        to="/"
        className="inline-block bg-black text-white px-8 py-3 font-bold tracking-widest text-sm hover:bg-[#660874] transition-colors"
      >
        BACK TO HOME
      </Link>
    </div>
  );
}
