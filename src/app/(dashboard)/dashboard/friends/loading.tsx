import { Skeleton } from "@/components/ui/skeleton";

const Loading = () => {
  return (
    <div className="container py-12">
      <Skeleton className="w-48 h-12 mb-8" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center p-4 bg-white rounded-lg border border-gray-200"
          >
            <Skeleton className="w-20 h-20 rounded-full mb-4" />
            <Skeleton className="w-32 h-6 mb-2" />
            <Skeleton className="w-48 h-4 mb-4" />
            <div className="flex gap-2 mt-auto">
              <Skeleton className="w-20 h-10 rounded-md" />
              <Skeleton className="w-24 h-10 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Loading;
