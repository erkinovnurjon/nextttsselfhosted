import { redirect } from "next/navigation";

// Eski yo'l — yangi kabinetga ko'chirildi
export default function OvozlarRedirect() {
  redirect("/cabinet/ovozlar");
}
