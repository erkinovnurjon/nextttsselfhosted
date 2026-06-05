import { redirect } from "next/navigation";

// Eski yo'l — yangi kabinet sozlamalariga ko'chirildi
export default function ProfileRedirect() {
  redirect("/cabinet/sozlamalar");
}
