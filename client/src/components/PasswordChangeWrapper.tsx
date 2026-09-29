import { useAuth } from "@/hooks/useAuth";
import PasswordChangeModal from "./PasswordChangeModal";

interface PasswordChangeWrapperProps {
  children: React.ReactNode;
}

export default function PasswordChangeWrapper({ children }: PasswordChangeWrapperProps) {
  const { user, requirePasswordChange, refreshUser } = useAuth();

  const handlePasswordChangeSuccess = () => {
    refreshUser();
  };

  return (
    <>
      {children}
      {requirePasswordChange && user && (
        <PasswordChangeModal
          open={requirePasswordChange}
          user={{
            id: user.id,
            email: user.email,
            displayName: user.displayName
          }}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}
    </>
  );
}