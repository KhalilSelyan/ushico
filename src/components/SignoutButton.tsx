"use client";

import { Loader2, LogOut } from "lucide-react";

import { signOut } from "@/auth/auth-client";
import { ButtonHTMLAttributes, FC, useState } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import Button from "./ui/ButtonOld";

interface SignOutButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

const SignOutButton: FC<SignOutButtonProps> = ({ ...props }) => {
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const router = useRouter();

  return (
    <Button
      {...props}
      variant="ghost"
      size="sm"
      onClick={async () => {
        setIsSigningOut(true);
        try {
          await signOut();
          router.push("/login");
        } catch (error) {
          toast.error("There was a problem signing out");
        } finally {
          setIsSigningOut(false);
        }
      }}
    >
      {isSigningOut ? (
        <Loader2 className="animate-spin h-4 w-4" />
      ) : (
        <LogOut className="w-4 h-4" />
      )}
    </Button>
  );
};

export default SignOutButton;
