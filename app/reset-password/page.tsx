import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) redirect("/auth/confirmation-error");
  return <ResetPasswordForm />;
}
