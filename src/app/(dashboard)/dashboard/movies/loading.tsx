export default function Loading() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
      </div>

      <div className="mb-8">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="w-24 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>

      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse"></div>
        <div className="flex gap-4 items-center">
          <div className="w-48 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="w-32 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`movie-${index + 1}`}
            className="bg-white rounded-lg shadow-md overflow-hidden"
          >
            <div className="w-full h-64 bg-gray-200 animate-pulse"></div>
            <div className="p-4">
              <div className="h-6 bg-gray-200 rounded w-full mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3 animate-pulse"></div>
              <div className="flex gap-2">
                <div className="flex-1 h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex-1 h-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
