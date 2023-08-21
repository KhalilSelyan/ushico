import { getSpecificUserById } from "@/helpers/getfriendsbyid";

// components/Header.tsx
const Header = async ({ userId }: { userId: string }) => {
  const user1 = await getSpecificUserById(userId);

  return (
    <div className="flex w-full items-center justify-center space-x-4">
      <h1 className="text-2xl font-bold">
        Room Host : {user1.name || "Loading..."}
      </h1>
    </div>
  );
};

export default Header;
