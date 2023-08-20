import { Skeleton } from "@/components/ui/skeleton";

const loading = () => {
  return (
    <div className="flex flex-col w-full pt-8 gap-4">
      <Skeleton className="font-bold text-5xl mb-8 text-transparent w-fit">
        Add a friend
      </Skeleton>
      <form className="max-w-sm">
        <span className="block text-sm font-medium leading-6 text-gray-900">
          <Skeleton className="w-full h-5 rounded" />
        </span>
        <div className="mt-2 flex gap-4">
          <Skeleton className="block w-full h-10 rounded" />
          <Skeleton className="w-20 h-10 rounded" />
        </div>
      </form>
    </div>
  );
};

export default loading;
