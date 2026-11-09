/* Shown at once while an admin page fetches its data, so a tap never feels like nothing happened. */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="skeleton h-8 w-1/3 rounded-md" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="skeleton h-24 rounded-lg" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-lg" aria-hidden="true" />
    </div>
  );
}
