export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-7 w-32 bg-gray-200 rounded-md mb-2" />
          <div className="h-4 w-48 bg-gray-100 rounded-md" />
        </div>
        <div className="h-10 w-40 bg-gray-200 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl p-6 h-24" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="h-5 w-44 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-32 bg-gray-100 rounded" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
              <div className="ml-auto h-4 w-20 bg-gray-200 rounded" />
              <div className="h-4 w-28 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
